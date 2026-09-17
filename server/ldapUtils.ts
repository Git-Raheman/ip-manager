import { Client } from 'ldapts';
import dns from 'dns';
import { LdapConfig } from '../src/types.js';
import { checkPort } from './networkUtils.js';

/**
 * Escapes characters with special meaning in LDAP search filters to prevent LDAP Injection.
 * RFC 4515: \ * ( ) \0
 */
export function escapeLdapFilter(input: string): string {
  return input
    .replace(/\\/g, '\\5c')
    .replace(/\*/g, '\\2a')
    .replace(/\(/g, '\\28')
    .replace(/\)/g, '\\29')
    .replace(/\0/g, '\\00');
}

/**
 * Resolves and normalizes the LDAP target URL.
 */
export function parseLdapUrl(serverUrl: string, useTls = true): { host: string; port: number; isTls: boolean; normalizedUrl: string } {
  const trimmed = serverUrl.trim();
  const cleaned = trimmed.replace(/^ldaps?:\/\//i, '');
  const [hostRaw, portRaw] = cleaned.split(':');
  const host = hostRaw ? hostRaw.trim() : 'localhost';

  let isTls = trimmed.toLowerCase().startsWith('ldaps://');
  let port = portRaw ? parseInt(portRaw, 10) : isTls ? 636 : 389;

  if (isNaN(port)) {
    port = isTls ? 636 : 389;
  }

  // If port is 636 or useTls is explicit with LDAPS, force ldaps://
  if (port === 636 || (isTls && port !== 389)) {
    isTls = true;
  }

  const normalizedUrl = `${isTls ? 'ldaps' : 'ldap'}://${host}:${port}`;
  return { host, port, isTls, normalizedUrl };
}

/**
 * Formats a user search filter by substituting the username placeholder.
 * Handles {username}, %s, and ensures enclosing parentheses.
 */
export function buildSearchFilter(rawFilter: string | undefined, username: string): string {
  const safeId = escapeLdapFilter(username.trim());
  let filter = (rawFilter && rawFilter.trim()) || '(&(objectCategory=person)(sAMAccountName={username}))';

  filter = filter.replace(/\{username\}/g, safeId).replace(/%s/g, safeId);

  if (!filter.startsWith('(') || !filter.endsWith(')')) {
    filter = `(${filter})`;
  }

  return filter;
}

/**
 * Authenticates a user against Active Directory / LDAP.
 * Performs real LDAP bind authentication against the directory controller.
 */
export async function authenticateLdapUser(
  ldapConfig: LdapConfig,
  identifier: string,
  password: string
): Promise<{ success: boolean; message: string; dn?: string }> {
  if (!ldapConfig || !ldapConfig.enabled) {
    return {
      success: false,
      message: 'Active Directory / LDAP authentication is disabled in system settings.',
    };
  }

  if (!ldapConfig.serverUrl || !ldapConfig.serverUrl.trim()) {
    return {
      success: false,
      message: 'LDAP Server URL is not configured.',
    };
  }

  if (!identifier || !password) {
    return {
      success: false,
      message: 'Username and directory password are required.',
    };
  }

  const { host, port, normalizedUrl } = parseLdapUrl(ldapConfig.serverUrl, ldapConfig.useTls);
  const timeoutMs = ldapConfig.timeoutMs || 5000;
  const cleanId = identifier.trim();

  // Mode 1: Search-then-Bind (Recommended for Enterprise Active Directory & OpenLDAP)
  if (
    ldapConfig.bindDn &&
    ldapConfig.bindDn.trim() &&
    ldapConfig.bindPassword &&
    ldapConfig.baseDn &&
    ldapConfig.baseDn.trim()
  ) {
    const serviceClient = new Client({
      url: normalizedUrl,
      timeout: timeoutMs,
      connectTimeout: timeoutMs,
      tlsOptions: { rejectUnauthorized: false },
      strictDN: false,
    });

    let targetUserDn: string | null = null;

    try {
      await serviceClient.bind(ldapConfig.bindDn.trim(), ldapConfig.bindPassword);

      const searchFilter = buildSearchFilter(ldapConfig.userSearchFilter, cleanId);

      const searchResult = await serviceClient.search(ldapConfig.baseDn.trim(), {
        scope: 'sub',
        filter: searchFilter,
        attributes: ['dn', 'sAMAccountName', 'userPrincipalName', 'mail', 'displayName'],
        sizeLimit: 2,
      });

      if (searchResult.searchEntries && searchResult.searchEntries.length > 0) {
        targetUserDn = searchResult.searchEntries[0].dn;
      }
    } catch (searchErr: any) {
      console.error('[LDAP Service Bind Error]:', searchErr.message || searchErr);
    } finally {
      try {
        await serviceClient.unbind();
      } catch {}
    }

    if (targetUserDn) {
      const userClient = new Client({
        url: normalizedUrl,
        timeout: timeoutMs,
        connectTimeout: timeoutMs,
        tlsOptions: { rejectUnauthorized: false },
        strictDN: false,
      });

      try {
        await userClient.bind(targetUserDn, password);
        return {
          success: true,
          message: `Active Directory authentication successful for ${cleanId}`,
          dn: targetUserDn,
        };
      } catch (bindErr: any) {
        return {
          success: false,
          message: 'Active Directory authentication failed: Invalid password or credentials.',
        };
      } finally {
        try {
          await userClient.unbind();
        } catch {}
      }
    }
  }

  // Mode 2: Direct Bind Strategy (UPN, DOMAIN\user, or DN)
  const candidateIdentities: string[] = [];

  if (cleanId.includes('@') || cleanId.toLowerCase().startsWith('cn=') || cleanId.toLowerCase().startsWith('uid=')) {
    candidateIdentities.push(cleanId);
  } else {
    if (ldapConfig.adNetbiosDomain && ldapConfig.adNetbiosDomain.trim()) {
      candidateIdentities.push(`${ldapConfig.adNetbiosDomain.trim()}\\${cleanId}`);
    }
    if (ldapConfig.domain && ldapConfig.domain.trim()) {
      candidateIdentities.push(`${cleanId}@${ldapConfig.domain.trim()}`);
    }
    if (ldapConfig.baseDn && ldapConfig.baseDn.trim()) {
      candidateIdentities.push(`CN=${cleanId},${ldapConfig.baseDn.trim()}`);
      candidateIdentities.push(`UID=${cleanId},${ldapConfig.baseDn.trim()}`);
    }
    candidateIdentities.push(cleanId);
  }

  for (const bindTarget of candidateIdentities) {
    const client = new Client({
      url: normalizedUrl,
      timeout: timeoutMs,
      connectTimeout: timeoutMs,
      tlsOptions: { rejectUnauthorized: false },
      strictDN: false,
    });

    try {
      await client.bind(bindTarget, password);
      return {
        success: true,
        message: `Active Directory bind successful as '${bindTarget}'`,
        dn: bindTarget,
      };
    } catch (err: any) {
      // Continue to next candidate identity
    } finally {
      try {
        await client.unbind();
      } catch {}
    }
  }

  return {
    success: false,
    message: `Active Directory authentication failed: Invalid username or password on ${host}:${port}.`,
  };
}

/**
 * Performs deep end-to-end diagnostic testing against an Active Directory / LDAP server.
 */
export async function testLdapDirectory(
  config: LdapConfig
): Promise<{ success: boolean; diagnostics: string[]; responseTimeMs: number; error?: string }> {
  const startTime = Date.now();
  const diagnostics: string[] = [];

  if (!config.serverUrl || !config.serverUrl.trim()) {
    return {
      success: false,
      diagnostics: ['[-] Server URL is missing or empty.'],
      responseTimeMs: 0,
      error: 'Missing Server URL',
    };
  }

  const { host, port, isTls, normalizedUrl } = parseLdapUrl(config.serverUrl, config.useTls);
  diagnostics.push(`[+] Target Active Directory Forest / Domain: ${config.domain || host}`);
  if (config.adNetbiosDomain && config.adNetbiosDomain.trim()) {
    diagnostics.push(`[+] NetBIOS Domain prefix: ${config.adNetbiosDomain.trim()}`);
  }
  diagnostics.push(`[+] Parsing directory target: ${host}:${port} (${isTls ? 'LDAPS (Port 636 / TLS)' : 'LDAP (Port 389 / Plaintext)'})`);

  // 1. DNS Resolution
  let resolvedIp = host;
  try {
    diagnostics.push(`[+] Resolving DNS hostname '${host}'...`);
    const dnsRes = await dns.promises.lookup(host);
    resolvedIp = dnsRes.address;
    diagnostics.push(`[+] DNS resolved successfully -> ${resolvedIp}`);
  } catch (dnsErr: any) {
    diagnostics.push(`[!] DNS lookup notice: ${dnsErr.message || 'Could not resolve hostname'}`);
  }

  // 2. TCP Socket Probe
  diagnostics.push(`[+] Probing TCP connection to ${resolvedIp}:${port}...`);
  const isPortOpen = await checkPort(resolvedIp, port, 2500);

  if (!isPortOpen) {
    const elapsed = Date.now() - startTime;
    diagnostics.push(`[-] TCP connection to ${host} (${resolvedIp}) on port ${port} timed out or was refused.`);
    diagnostics.push(`[-] Check directory host, firewall rules, and network routing.`);
    return {
      success: false,
      diagnostics,
      responseTimeMs: elapsed,
      error: `Connection to ${host}:${port} timed out or was refused.`,
    };
  }

  diagnostics.push(`[+] TCP socket connected successfully.`);

  // 3. LDAP Protocol Handshake & Bind Verification
  const client = new Client({
    url: normalizedUrl,
    timeout: config.timeoutMs || 5000,
    connectTimeout: config.timeoutMs || 5000,
    tlsOptions: { rejectUnauthorized: false },
    strictDN: false,
  });

  try {
    if (config.bindDn && config.bindDn.trim() && config.bindPassword) {
      diagnostics.push(`[+] Attempting service account bind with DN: '${config.bindDn.trim()}'...`);
      await client.bind(config.bindDn.trim(), config.bindPassword);
      diagnostics.push(`[+] Service account LDAP bind successful!`);

      // 4. Base DN Search Test
      if (config.baseDn && config.baseDn.trim()) {
        diagnostics.push(`[+] Querying search root base DN: '${config.baseDn.trim()}'...`);
        try {
          const searchRes = await client.search(config.baseDn.trim(), {
            scope: 'base',
            attributes: ['namingContexts', 'subschemaSubentry', 'defaultNamingContext'],
            sizeLimit: 1,
          });
          diagnostics.push(`[+] Base DN query returned ${searchRes.searchEntries.length} root entry.`);
        } catch (searchErr: any) {
          diagnostics.push(`[!] Base DN search query notice: ${searchErr.message}`);
        }
      }
    } else {
      diagnostics.push(`[+] Attempting anonymous directory probe...`);
      try {
        await client.bind('', '');
        diagnostics.push(`[+] Anonymous directory bind accepted by server.`);
      } catch (anonErr: any) {
        diagnostics.push(`[!] Note: Anonymous bind is disabled by directory policy (Standard for Active Directory). Service account required.`);
      }
    }

    const totalDuration = Date.now() - startTime;
    diagnostics.push(`[+] Active Directory / LDAP integration verified operational (${totalDuration}ms).`);

    return {
      success: true,
      diagnostics,
      responseTimeMs: totalDuration,
    };
  } catch (ldapErr: any) {
    const totalDuration = Date.now() - startTime;
    const errMsg = ldapErr.message || String(ldapErr);
    diagnostics.push(`[-] LDAP Protocol Error: ${errMsg}`);

    if (port === 389 && isTls) {
      diagnostics.push(`[!] TIP: Port 389 is plaintext LDAP. For encrypted LDAPS, change the Server URL to Port 636 (e.g. ldaps://${host}:636).`);
    } else if (port === 389 && errMsg.toLowerCase().includes('socket disconnected')) {
      diagnostics.push(`[!] TIP: Active Directory may require LDAPS on Port 636 (ldaps://${host}:636) or user UPN bind format.`);
    }

    return {
      success: false,
      diagnostics,
      responseTimeMs: totalDuration,
      error: errMsg,
    };
  } finally {
    try {
      await serviceClientUnbind(client);
    } catch {}
  }
}

async function serviceClientUnbind(client: Client) {
  try {
    await client.unbind();
  } catch {}
}
