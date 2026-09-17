/**
 * Typo-Tolerance, Levenshtein Distance, and Fuzzy Intent Matcher for IPAM Assistant
 */

export type ParsedIntent =
  | 'CANCEL'
  | 'CLEAR_CHAT'
  | 'NEW_CHAT'
  | 'CREATE_SUBNET'
  | 'DELETE_SUBNET'
  | 'CREATE_USER'
  | 'DELETE_USER'
  | 'UPDATE_PASSWORD'
  | 'DEVICE_CLASSIFICATION'
  | 'ALLOCATE_IP'
  | 'UPDATE_IP'
  | 'RELEASE_IP'
  | 'FIND_NEXT_IP'
  | 'PING_IP'
  | 'WHO_USES_OR_FIND'
  | 'SUBNET_SUMMARY'
  | 'LEARN_OR_MEMORY'
  | 'AUDIT_LOGS'
  | 'HELP'
  | 'UNKNOWN';

export interface FuzzyMatchResult {
  intent: ParsedIntent;
  confidence: number;
  normalizedQuery: string;
  detectedAction: string;
  didYouMeanPrompt?: string;
  isFuzzyCorrected: boolean;
}

/**
 * Compute Levenshtein distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  const lenA = a.length;
  const lenB = b.length;

  if (lenA === 0) return lenB;
  if (lenB === 0) return lenA;

  for (let i = 0; i <= lenB; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= lenA; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= lenB; i++) {
    for (let j = 1; j <= lenA; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[lenB][lenA];
}

/**
 * Similarity ratio between 0.0 and 1.0
 */
export function stringSimilarity(strA: string, strB: string): number {
  const maxLen = Math.max(strA.length, strB.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(strA.toLowerCase(), strB.toLowerCase());
  return 1 - dist / maxLen;
}

// Common typo corrections dictionary
const TYPO_MAP: Record<string, string> = {
  // Create / Add
  'craete': 'create',
  'creat': 'create',
  'cretae': 'create',
  'crte': 'create',
  'mkae': 'make',
  'ad': 'add',

  // Subnet
  'subnt': 'subnet',
  'subent': 'subnet',
  'subn': 'subnet',
  'sunet': 'subnet',
  'subnets': 'subnet',
  'subnte': 'subnet',

  // User
  'usr': 'user',
  'uesr': 'user',
  'usre': 'user',
  'acct': 'account',
  'accnt': 'account',

  // Password
  'paswrd': 'password',
  'passwrd': 'password',
  'pasword': 'password',
  'pswrd': 'password',
  'pass': 'password',
  'passwd': 'password',

  // Allocate
  'alocate': 'allocate',
  'allocat': 'allocate',
  'allcoate': 'allocate',
  'asign': 'assign',
  'asgn': 'assign',

  // Release / Delete
  'relese': 'release',
  'releas': 'release',
  'rlease': 'release',
  'delte': 'delete',
  'delet': 'delete',
  'del': 'delete',
  'deallocat': 'deallocate',

  // Ping
  'pign': 'ping',
  'png': 'ping',
  'pgin': 'ping',
  'pinh': 'ping',

  // Find / Search
  'fnd': 'find',
  'fidn': 'find',
  'serch': 'search',
  'sarch': 'search',
  'lokup': 'lookup',
  'lukoop': 'lookup',

  // Classification / Category
  'categraiotn': 'classification',
  'categori': 'category',
  'categor': 'category',
  'clasification': 'classification',
  'classifcation': 'classification',
  'devise': 'device',
  'devic': 'device',

  // Summary / Stats
  'sumary': 'summary',
  'summery': 'summary',
  'stat': 'stats',
  'capcity': 'capacity',
  'utilizaton': 'utilization',
  'util': 'utilization',
};

/**
 * Normalize and auto-correct misspelled words in user query
 */
export function normalizeAndCorrectTypos(input: string): {
  normalized: string;
  hasCorrections: boolean;
  correctedWords: Array<{ original: string; corrected: string }>;
} {
  const words = input.trim().split(/\s+/);
  const correctedWords: Array<{ original: string; corrected: string }> = [];
  let hasCorrections = false;

  const normalizedWords = words.map((w) => {
    const cleanWord = w.toLowerCase().replace(/[^a-z0-9_\-\.\/]/g, '');
    if (TYPO_MAP[cleanWord]) {
      hasCorrections = true;
      correctedWords.push({ original: w, corrected: TYPO_MAP[cleanWord] });
      return TYPO_MAP[cleanWord];
    }

    // Check fuzzy match against key terms
    for (const [typoKey, correctTerm] of Object.entries(TYPO_MAP)) {
      if (cleanWord.length >= 4 && levenshteinDistance(cleanWord, typoKey) === 1) {
        hasCorrections = true;
        correctedWords.push({ original: w, corrected: correctTerm });
        return correctTerm;
      }
    }

    return w;
  });

  return {
    normalized: normalizedWords.join(' '),
    hasCorrections,
    correctedWords,
  };
}

/**
 * Classify user intent with fuzzy tolerance
 */
export function detectFuzzyIntent(query: string): FuzzyMatchResult {
  const { normalized, hasCorrections } = normalizeAndCorrectTypos(query);
  const lower = normalized.toLowerCase().trim();

  // 0. Cancel / Abort operation
  if (
    lower === 'cancel' ||
    lower === 'abort' ||
    lower === 'stop' ||
    lower === 'nevermind' ||
    lower === 'exit' ||
    lower === 'clear wizard' ||
    lower.startsWith('cancel operation') ||
    lower.startsWith('cancel wizard')
  ) {
    return {
      intent: 'CANCEL',
      confidence: 1.0,
      normalizedQuery: normalized,
      detectedAction: 'Cancel Operation',
      didYouMeanPrompt: 'Cancel',
      isFuzzyCorrected: hasCorrections,
    };
  }

  // 0.1 Clear Chat History
  if (
    lower === 'clear' ||
    lower === 'cls' ||
    lower === 'clear chat' ||
    lower === 'clearchat' ||
    lower === 'clean chat' ||
    lower === 'clear history' ||
    lower === 'delete chat' ||
    lower === 'erase chat'
  ) {
    return {
      intent: 'CLEAR_CHAT',
      confidence: 1.0,
      normalizedQuery: normalized,
      detectedAction: 'Clear Chat History',
      didYouMeanPrompt: 'Clear Chat',
      isFuzzyCorrected: hasCorrections,
    };
  }

  // 0.2 Start New Chat / Conversation
  if (
    lower === 'new chat' ||
    lower === 'newchat' ||
    lower === 'reset chat' ||
    lower === 'resetchat' ||
    lower === 'start over' ||
    lower === 'startover' ||
    lower === 'restart' ||
    lower === 'restart chat' ||
    lower === 'new conversation'
  ) {
    return {
      intent: 'NEW_CHAT',
      confidence: 1.0,
      normalizedQuery: normalized,
      detectedAction: 'Start New Conversation',
      didYouMeanPrompt: 'New Chat',
      isFuzzyCorrected: hasCorrections,
    };
  }

  // 1. Password change / update
  if (
    lower.includes('change password') ||
    lower.includes('update password') ||
    lower.includes('reset password') ||
    lower.includes('set password') ||
    (lower.includes('password') && (lower.includes('change') || lower.includes('update') || lower.includes('reset') || lower.includes('for user')))
  ) {
    return {
      intent: 'UPDATE_PASSWORD',
      confidence: 0.95,
      normalizedQuery: normalized,
      detectedAction: 'Change User Password',
      didYouMeanPrompt: 'Update Password for User',
      isFuzzyCorrected: hasCorrections,
    };
  }

  // 2. Create Subnet
  if (
    (lower.includes('create') && lower.includes('subnet')) ||
    (lower.includes('add') && lower.includes('subnet')) ||
    (lower.includes('new') && lower.includes('subnet')) ||
    (lower.includes('make') && lower.includes('subnet')) ||
    lower.startsWith('subnet create') ||
    lower.startsWith('create new subnet')
  ) {
    return {
      intent: 'CREATE_SUBNET',
      confidence: 0.95,
      normalizedQuery: normalized,
      detectedAction: 'Create New Subnet',
      didYouMeanPrompt: 'Create New Subnet',
      isFuzzyCorrected: hasCorrections,
    };
  }

  // 3. Delete Subnet
  if (
    (lower.includes('delete') && lower.includes('subnet')) ||
    (lower.includes('remove') && lower.includes('subnet')) ||
    (lower.includes('destroy') && lower.includes('subnet'))
  ) {
    return {
      intent: 'DELETE_SUBNET',
      confidence: 0.92,
      normalizedQuery: normalized,
      detectedAction: 'Delete Subnet',
      didYouMeanPrompt: 'Delete Subnet',
      isFuzzyCorrected: hasCorrections,
    };
  }

  // 4. Create User
  if (
    (lower.includes('create') && (lower.includes('user') || lower.includes('account'))) ||
    (lower.includes('add') && (lower.includes('user') || lower.includes('account'))) ||
    (lower.includes('new') && (lower.includes('user') || lower.includes('account'))) ||
    lower.startsWith('user create')
  ) {
    return {
      intent: 'CREATE_USER',
      confidence: 0.95,
      normalizedQuery: normalized,
      detectedAction: 'Create User Account',
      didYouMeanPrompt: 'Create User Account',
      isFuzzyCorrected: hasCorrections,
    };
  }

  // 4.1 Delete User
  if (
    (lower.includes('delete') && (lower.includes('user') || lower.includes('account'))) ||
    (lower.includes('remove') && (lower.includes('user') || lower.includes('account'))) ||
    (lower.includes('destroy') && (lower.includes('user') || lower.includes('account')))
  ) {
    return {
      intent: 'DELETE_USER',
      confidence: 0.95,
      normalizedQuery: normalized,
      detectedAction: 'Delete User Account',
      didYouMeanPrompt: 'Delete User Account',
      isFuzzyCorrected: hasCorrections,
    };
  }

  // 5. Device Classification / Categories
  if (
    lower.includes('device classification') ||
    lower.includes('device category') ||
    lower.includes('device type') ||
    lower.includes('add device') ||
    lower.includes('device categories') ||
    lower.includes('device classifications') ||
    lower.includes('classification') ||
    lower.includes('classifications') ||
    lower.includes('device types') ||
    (lower.includes('create') && (lower.includes('classification') || lower.includes('category') || lower.includes('type'))) ||
    (lower.includes('add') && (lower.includes('classification') || lower.includes('category') || lower.includes('type')))
  ) {
    return {
      intent: 'DEVICE_CLASSIFICATION',
      confidence: 0.92,
      normalizedQuery: normalized,
      detectedAction: 'Manage Device Classifications',
      didYouMeanPrompt: 'Device Categories',
      isFuzzyCorrected: hasCorrections,
    };
  }

  // 6. Ping / Connectivity
  if (
    lower.startsWith('ping ') ||
    lower === 'ping' ||
    lower.includes('is online') ||
    lower.includes('check latency') ||
    lower.includes('test ip')
  ) {
    return {
      intent: 'PING_IP',
      confidence: 0.95,
      normalizedQuery: normalized,
      detectedAction: 'Ping IP Address',
      didYouMeanPrompt: 'Ping IP',
      isFuzzyCorrected: hasCorrections,
    };
  }

  // 7. Allocate IP
  if (
    lower.startsWith('allocate') ||
    lower.startsWith('assign') ||
    lower.startsWith('add ip') ||
    lower.startsWith('create ip') ||
    (lower.includes('allocate') && !lower.includes('subnet') && !lower.includes('user'))
  ) {
    return {
      intent: 'ALLOCATE_IP',
      confidence: 0.95,
      normalizedQuery: normalized,
      detectedAction: 'Allocate IP Address',
      didYouMeanPrompt: 'Allocate IP',
      isFuzzyCorrected: hasCorrections,
    };
  }

  // 8. Release IP
  if (
    lower.startsWith('release') ||
    lower.startsWith('free ip') ||
    lower.startsWith('delete ip') ||
    lower.startsWith('deallocate')
  ) {
    return {
      intent: 'RELEASE_IP',
      confidence: 0.95,
      normalizedQuery: normalized,
      detectedAction: 'Release IP Address',
      didYouMeanPrompt: 'Release IP',
      isFuzzyCorrected: hasCorrections,
    };
  }

  // 9. Who uses / Find / Ports / Notes Scan / Suffix / Octet match
  if (
    lower.startsWith('who use') ||
    lower.startsWith('who has') ||
    lower.startsWith('who is using') ||
    lower.startsWith('find ') ||
    lower.startsWith('search ') ||
    lower.startsWith('lookup ') ||
    lower.startsWith('where is ') ||
    lower.startsWith('scan ') ||
    lower.startsWith('print ') ||
    lower.includes('port') ||
    lower.includes('ports') ||
    lower.includes('note') ||
    lower.includes('notes') ||
    lower.includes('that use') ||
    lower.includes('that uses') ||
    lower.includes('using port') ||
    lower.includes('used port') ||
    lower.startsWith('who ') ||
    /\b(?:port\s*[:=]?\s*|ports\s*[:=]?\s*)\d{1,5}\b/i.test(lower) ||
    /\b(80|443|22|53|25|389|636|3306|5432|8080|8443|6379|27017|3389|161|123|21|23|3000|5000|8000|9000)\b/.test(lower) ||
    /^(?:who\s+use|who\s+has|find|search|lookup|scan|show|list|get)\b/i.test(lower) ||
    /^\d{1,3}\.\d{1,3}(\.\d{1,3})*$/.test(lower) ||
    /^\.?\d{1,3}$/.test(lower)
  ) {
    return {
      intent: 'WHO_USES_OR_FIND',
      confidence: 0.95,
      normalizedQuery: normalized,
      detectedAction: 'Find & Identify IP / Owner / Ports / Notes',
      didYouMeanPrompt: 'Search IP Records & Notes',
      isFuzzyCorrected: hasCorrections,
    };
  }

  // 10. Subnet Capacity / Utilization Summary
  if (
    lower.includes('subnet summary') ||
    lower.includes('utilization') ||
    lower.includes('capacity') ||
    lower.includes('stats') ||
    lower.includes('list subnets')
  ) {
    return {
      intent: 'SUBNET_SUMMARY',
      confidence: 0.95,
      normalizedQuery: normalized,
      detectedAction: 'Subnet Utilization Summary',
      didYouMeanPrompt: 'Subnet Utilization Summary',
      isFuzzyCorrected: hasCorrections,
    };
  }

  // 11. Learn / Memory
  if (
    lower.startsWith('remember ') ||
    lower.startsWith('learn ') ||
    lower.startsWith('teach ') ||
    lower.includes('what have you learned') ||
    lower.includes('show memory') ||
    lower === 'memory'
  ) {
    return {
      intent: 'LEARN_OR_MEMORY',
      confidence: 0.95,
      normalizedQuery: normalized,
      detectedAction: 'Knowledge & Memory Management',
      didYouMeanPrompt: 'Show Learned Memory',
      isFuzzyCorrected: hasCorrections,
    };
  }

  // 12. Audit Logs
  if (
    lower.includes('audit') ||
    lower.includes('log') ||
    lower.includes('history') ||
    lower.includes('recent activity')
  ) {
    return {
      intent: 'AUDIT_LOGS',
      confidence: 0.92,
      normalizedQuery: normalized,
      detectedAction: 'Security Audit Logs',
      didYouMeanPrompt: 'Show Audit Logs',
      isFuzzyCorrected: hasCorrections,
    };
  }

  // 13. Help / Greeting & Command Guide
  if (
    lower === 'help' ||
    lower === '/help' ||
    lower === 'cmd' ||
    lower === 'cmds' ||
    lower === 'commands' ||
    lower === 'command' ||
    lower === 'options' ||
    lower === 'guide' ||
    lower === 'menu' ||
    lower === 'features' ||
    lower === 'hi' ||
    lower === 'hello' ||
    lower === 'hey' ||
    lower.includes('show command') ||
    lower.includes('list command') ||
    lower.includes('all command') ||
    lower.includes('what can you do') ||
    lower.includes('how to use') ||
    lower.startsWith('help ') ||
    lower.includes('who are you')
  ) {
    return {
      intent: 'HELP',
      confidence: 1.0,
      normalizedQuery: normalized,
      detectedAction: 'Help & Supported Commands Guide',
      didYouMeanPrompt: 'Help & Command Guide',
      isFuzzyCorrected: hasCorrections,
    };
  }

  return {
    intent: 'UNKNOWN',
    confidence: 0.0,
    normalizedQuery: normalized,
    detectedAction: 'Unknown Query',
    isFuzzyCorrected: hasCorrections,
  };
}
