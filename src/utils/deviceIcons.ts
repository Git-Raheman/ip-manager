import React from 'react';
import {
  Cctv,
  Camera,
  Video,
  Webcam,
  Server,
  Router,
  Network,
  Shield,
  Cpu,
  Laptop,
  Printer,
  HardDrive,
  Wifi,
  Database,
  Terminal,
  Smartphone,
  Tablet,
  Radio,
  Box,
  Boxes,
  Monitor,
  Tv,
  Phone,
  PhoneCall,
  Zap,
  BatteryCharging,
  Battery,
  Plug,
  Fan,
  Thermometer,
  Gauge,
  Activity,
  DoorClosed,
  Bell,
  Siren,
  Lock,
  Key,
  Fingerprint,
  Eye,
  Cloud,
  Cable,
  Disc,
  Scan,
  QrCode,
  Container,
  Workflow,
  Bot,
  Projector,
  Speaker,
  Headphones,
  Mic,
  Watch,
  Flame,
  Lightbulb,
  Antenna,
  Satellite,
  Cast,
  Layers,
  Archive,
  LucideIcon,
} from 'lucide-react';

export interface DeviceIconDefinition {
  id: string;
  label: string;
  icon: LucideIcon;
  category: string;
  keywords: string[];
}

export const ICON_CATEGORIES = [
  'All',
  'Surveillance & Security',
  'Compute & Servers',
  'Network Infrastructure',
  'Storage & Backup',
  'End-User Devices',
  'Power & Environmental IoT',
] as const;

export type IconCategory = (typeof ICON_CATEGORIES)[number];

export const AVAILABLE_ICONS: DeviceIconDefinition[] = [
  // 1. Surveillance & Physical Security
  {
    id: 'cctv',
    label: 'CCTV Camera',
    icon: Cctv,
    category: 'Surveillance & Security',
    keywords: ['cctv', 'surveillance', 'camera', 'security', 'dome', 'bullet', 'nvr', 'monitoring'],
  },
  {
    id: 'camera',
    label: 'IP Camera / PTZ',
    icon: Camera,
    category: 'Surveillance & Security',
    keywords: ['camera', 'ipcam', 'ptz', 'surveillance', 'video', 'lens'],
  },
  {
    id: 'video',
    label: 'Video / NVR / DVR',
    icon: Video,
    category: 'Surveillance & Security',
    keywords: ['video', 'nvr', 'dvr', 'recorder', 'stream', 'cctv', 'footage'],
  },
  {
    id: 'webcam',
    label: 'Webcam / Video Conf',
    icon: Webcam,
    category: 'Surveillance & Security',
    keywords: ['webcam', 'conference', 'meeting', 'zoom', 'teams', 'camera'],
  },
  {
    id: 'shield',
    label: 'Firewall / Security Gateway',
    icon: Shield,
    category: 'Surveillance & Security',
    keywords: ['firewall', 'shield', 'security', 'ips', 'ids', 'ngfw', 'perimeter'],
  },
  {
    id: 'lock',
    label: 'Access Control Lock',
    icon: Lock,
    category: 'Surveillance & Security',
    keywords: ['lock', 'door', 'access', 'secure', 'security', 'maglock'],
  },
  {
    id: 'key',
    label: 'Badge Reader / Keypad',
    icon: Key,
    category: 'Surveillance & Security',
    keywords: ['key', 'badge', 'rfid', 'keycard', 'auth', 'access'],
  },
  {
    id: 'fingerprint',
    label: 'Biometric Scanner',
    icon: Fingerprint,
    category: 'Surveillance & Security',
    keywords: ['fingerprint', 'biometric', 'access', 'security', 'identity'],
  },
  {
    id: 'eye',
    label: 'Motion / Optical Sensor',
    icon: Eye,
    category: 'Surveillance & Security',
    keywords: ['motion', 'sensor', 'pir', 'eye', 'optical', 'detector'],
  },
  {
    id: 'siren',
    label: 'Alarm / Siren',
    icon: Siren,
    category: 'Surveillance & Security',
    keywords: ['alarm', 'siren', 'alert', 'warning', 'emergency'],
  },
  {
    id: 'bell',
    label: 'Smart Doorbell / Intercom',
    icon: Bell,
    category: 'Surveillance & Security',
    keywords: ['doorbell', 'intercom', 'bell', 'entry', 'visitor'],
  },
  {
    id: 'door',
    label: 'Smart Door / Turnstile',
    icon: DoorClosed,
    category: 'Surveillance & Security',
    keywords: ['door', 'turnstile', 'gate', 'entry', 'portal', 'barrier'],
  },

  // 2. Compute & Servers
  {
    id: 'server',
    label: 'Bare-Metal / Rack Server',
    icon: Server,
    category: 'Compute & Servers',
    keywords: ['server', 'rack', 'host', 'compute', 'hardware', 'node'],
  },
  {
    id: 'server-rack',
    label: 'Chassis / Server Stack',
    icon: Layers,
    category: 'Compute & Servers',
    keywords: ['cluster', 'stack', 'rack', 'chassis', 'layers', 'modular'],
  },
  {
    id: 'database',
    label: 'Database Server / Cluster',
    icon: Database,
    category: 'Compute & Servers',
    keywords: ['database', 'db', 'sql', 'postgres', 'mysql', 'oracle', 'nosql', 'mongo'],
  },
  {
    id: 'cpu',
    label: 'Compute / VM / Processor',
    icon: Cpu,
    category: 'Compute & Servers',
    keywords: ['vm', 'virtual', 'cpu', 'hypervisor', 'esxi', 'proxmox', 'compute'],
  },
  {
    id: 'boxes',
    label: 'Blade Chassis / Nodes',
    icon: Boxes,
    category: 'Compute & Servers',
    keywords: ['blade', 'cluster', 'nodes', 'farm', 'hpc', 'boxes'],
  },
  {
    id: 'container',
    label: 'Container / Docker Host',
    icon: Container,
    category: 'Compute & Servers',
    keywords: ['container', 'docker', 'kubernetes', 'k8s', 'pod', 'microservice'],
  },
  {
    id: 'cloud',
    label: 'Cloud / VPC Gateway',
    icon: Cloud,
    category: 'Compute & Servers',
    keywords: ['cloud', 'aws', 'azure', 'gcp', 'vpc', 'virtual-private', 'iaas'],
  },
  {
    id: 'bot',
    label: 'AI Accelerator / Bot',
    icon: Bot,
    category: 'Compute & Servers',
    keywords: ['ai', 'bot', 'gpu', 'npu', 'agent', 'automation', 'robotics'],
  },
  {
    id: 'box',
    label: 'Generic Appliance',
    icon: Box,
    category: 'Compute & Servers',
    keywords: ['appliance', 'generic', 'device', 'hardware', 'box', 'embedded'],
  },

  // 3. Network Infrastructure
  {
    id: 'router',
    label: 'Core / Edge Router',
    icon: Router,
    category: 'Network Infrastructure',
    keywords: ['router', 'gateway', 'bgp', 'ospf', 'edge', 'sd-wan', 'layer3'],
  },
  {
    id: 'network',
    label: 'Switch / Switch Fabric',
    icon: Network,
    category: 'Network Infrastructure',
    keywords: ['switch', 'network', 'lan', 'ethernet', 'vlan', 'fabric', 'layer2'],
  },
  {
    id: 'wifi',
    label: 'Wireless AP (Wi-Fi)',
    icon: Wifi,
    category: 'Network Infrastructure',
    keywords: ['wifi', 'wireless', 'ap', 'wlan', 'access-point', 'hotspot'],
  },
  {
    id: 'radio',
    label: 'Microwave / Radio Link',
    icon: Radio,
    category: 'Network Infrastructure',
    keywords: ['radio', 'telemetry', 'microwave', 'point-to-point', 'wireless-bridge'],
  },
  {
    id: 'antenna',
    label: 'RF Antenna / Tower',
    icon: Antenna,
    category: 'Network Infrastructure',
    keywords: ['antenna', 'rf', 'tower', 'cellular', '5g', 'lte', 'base-station'],
  },
  {
    id: 'satellite',
    label: 'Satellite Terminal / VSAT',
    icon: Satellite,
    category: 'Network Infrastructure',
    keywords: ['satellite', 'vsat', 'starlink', 'uplink', 'space', 'remote'],
  },
  {
    id: 'cable',
    label: 'Trunk / Fiber Patch Link',
    icon: Cable,
    category: 'Network Infrastructure',
    keywords: ['cable', 'fiber', 'copper', 'patch', 'trunk', 'backbone'],
  },
  {
    id: 'network-hub',
    label: 'Hub / Traffic Dispatcher',
    icon: Workflow,
    category: 'Network Infrastructure',
    keywords: ['hub', 'loadbalancer', 'lb', 'dispatcher', 'orchestrator', 'flow'],
  },
  {
    id: 'activity',
    label: 'Packet Analyzer / Probe',
    icon: Activity,
    category: 'Network Infrastructure',
    keywords: ['activity', 'analyzer', 'probe', 'tap', 'telemetry', 'monitor', 'snmp'],
  },

  // 4. Storage & Backup
  {
    id: 'hard-drive',
    label: 'Storage Array (SAN / NAS)',
    icon: HardDrive,
    category: 'Storage & Backup',
    keywords: ['storage', 'san', 'nas', 'hdd', 'ssd', 'raid', 'iscsi'],
  },
  {
    id: 'disc',
    label: 'Optical / ISO Library',
    icon: Disc,
    category: 'Storage & Backup',
    keywords: ['disc', 'cd', 'dvd', 'optical', 'iso', 'media'],
  },
  {
    id: 'archive',
    label: 'Backup Vault / Tape Archive',
    icon: Archive,
    category: 'Storage & Backup',
    keywords: ['archive', 'backup', 'tape', 'vault', 'cold-storage', 'retention'],
  },

  // 5. End-User Devices & Peripherals
  {
    id: 'workstation',
    label: 'Desktop PC / Workstation',
    icon: Monitor,
    category: 'End-User Devices',
    keywords: ['desktop', 'pc', 'workstation', 'monitor', 'client', 'computer'],
  },
  {
    id: 'laptop',
    label: 'Corporate Laptop',
    icon: Laptop,
    category: 'End-User Devices',
    keywords: ['laptop', 'notebook', 'portable', 'mobile-pc', 'macbook'],
  },
  {
    id: 'tablet',
    label: 'Tablet / Kiosk / POS',
    icon: Tablet,
    category: 'End-User Devices',
    keywords: ['tablet', 'ipad', 'kiosk', 'pos', 'touchscreen', 'point-of-sale'],
  },
  {
    id: 'smartphone',
    label: 'Mobile / Handheld Scanner',
    icon: Smartphone,
    category: 'End-User Devices',
    keywords: ['phone', 'mobile', 'smartphone', 'scanner', 'handheld', 'android', 'ios'],
  },
  {
    id: 'printer',
    label: 'Network Printer / MFP',
    icon: Printer,
    category: 'End-User Devices',
    keywords: ['printer', 'mfp', 'scanner', 'copier', 'plotter', 'paper'],
  },
  {
    id: 'phone',
    label: 'VoIP Phone / Desk Phone',
    icon: Phone,
    category: 'End-User Devices',
    keywords: ['voip', 'sip', 'phone', 'telephone', 'deskphone', 'call'],
  },
  {
    id: 'phone-call',
    label: 'PBX / Call Manager',
    icon: PhoneCall,
    category: 'End-User Devices',
    keywords: ['pbx', 'asterisk', 'cisco-cucm', 'callmanager', 'voice', 'telephony'],
  },
  {
    id: 'terminal',
    label: 'Console / Terminal Kiosk',
    icon: Terminal,
    category: 'End-User Devices',
    keywords: ['terminal', 'cli', 'console', 'shell', 'kiosk', 'ssh'],
  },
  {
    id: 'tv',
    label: 'Smart TV / Digital Signage',
    icon: Tv,
    category: 'End-User Devices',
    keywords: ['tv', 'display', 'screen', 'signage', 'monitor', 'presentation'],
  },
  {
    id: 'projector',
    label: 'Conference Projector',
    icon: Projector,
    category: 'End-User Devices',
    keywords: ['projector', 'av', 'conference', 'meeting', 'beamer'],
  },
  {
    id: 'speaker',
    label: 'Smart Speaker / PA Horn',
    icon: Speaker,
    category: 'End-User Devices',
    keywords: ['speaker', 'audio', 'pa-system', 'paging', 'sound', 'intercom'],
  },
  {
    id: 'headphones',
    label: 'Call Center Headset',
    icon: Headphones,
    category: 'End-User Devices',
    keywords: ['headset', 'headphones', 'callcenter', 'audio', 'operator'],
  },
  {
    id: 'mic',
    label: 'Conference Microphone',
    icon: Mic,
    category: 'End-User Devices',
    keywords: ['mic', 'microphone', 'audio', 'av', 'pickup'],
  },
  {
    id: 'watch',
    label: 'Wearable / IoT Watch',
    icon: Watch,
    category: 'End-User Devices',
    keywords: ['watch', 'wearable', 'smartwatch', 'telemetry', 'health'],
  },

  // 6. Power, Cooling & Environmental IoT
  {
    id: 'zap',
    label: 'Smart PDU / UPS Power',
    icon: Zap,
    category: 'Power & Environmental IoT',
    keywords: ['pdu', 'ups', 'power', 'electricity', 'energy', 'zap', 'inverter'],
  },
  {
    id: 'battery',
    label: 'Battery Backup Unit',
    icon: Battery,
    category: 'Power & Environmental IoT',
    keywords: ['battery', 'backup', 'ups', 'cell', 'energy-storage'],
  },
  {
    id: 'battery-charging',
    label: 'Solar / Inverter Charger',
    icon: BatteryCharging,
    category: 'Power & Environmental IoT',
    keywords: ['charger', 'solar', 'inverter', 'green-power', 'charging'],
  },
  {
    id: 'plug',
    label: 'Smart Outlet / Smart Plug',
    icon: Plug,
    category: 'Power & Environmental IoT',
    keywords: ['plug', 'socket', 'outlet', 'smart-plug', 'switched-pdu'],
  },
  {
    id: 'fan',
    label: 'Cooling / HVAC Unit',
    icon: Fan,
    category: 'Power & Environmental IoT',
    keywords: ['fan', 'hvac', 'cooling', 'crac', 'airflow', 'ventilation'],
  },
  {
    id: 'thermometer',
    label: 'Temperature / Humidity Sensor',
    icon: Thermometer,
    category: 'Power & Environmental IoT',
    keywords: ['temp', 'temperature', 'sensor', 'humidity', 'environmental', 'climate'],
  },
  {
    id: 'gauge',
    label: 'Pressure / Power Meter',
    icon: Gauge,
    category: 'Power & Environmental IoT',
    keywords: ['meter', 'gauge', 'pressure', 'flow', 'volts', 'amps', 'kwh'],
  },
  {
    id: 'lightbulb',
    label: 'Smart Lighting Controller',
    icon: Lightbulb,
    category: 'Power & Environmental IoT',
    keywords: ['light', 'lighting', 'dali', 'smart-light', 'building-automation'],
  },
  {
    id: 'flame',
    label: 'Fire / Heat Detector',
    icon: Flame,
    category: 'Power & Environmental IoT',
    keywords: ['fire', 'heat', 'smoke', 'detector', 'sensor', 'suppression'],
  },
  {
    id: 'scan',
    label: 'Barcode / RFID Scanner',
    icon: Scan,
    category: 'Power & Environmental IoT',
    keywords: ['scanner', 'rfid', 'barcode', 'inventory', 'warehouse'],
  },
  {
    id: 'qrcode',
    label: 'QR Access Gate',
    icon: QrCode,
    category: 'Power & Environmental IoT',
    keywords: ['qr', 'qrcode', 'access', 'turnstile', 'scanner', 'gate'],
  },
  {
    id: 'cast',
    label: 'Streaming / Cast Receiver',
    icon: Cast,
    category: 'Power & Environmental IoT',
    keywords: ['cast', 'chromecast', 'airplay', 'streaming', 'wireless-display'],
  },
];

// O(1) icon lookup index
export const DEVICE_ICON_MAP: Record<string, LucideIcon> = AVAILABLE_ICONS.reduce(
  (acc, item) => {
    acc[item.id] = item.icon;
    return acc;
  },
  {} as Record<string, LucideIcon>
);

// Map common aliases and synonyms to their corresponding icon IDs
export const ICON_ALIASES: Record<string, string> = {
  // CCTV & Surveillance
  cctv: 'cctv',
  cam: 'camera',
  camera: 'camera',
  ipcam: 'camera',
  dvr: 'video',
  nvr: 'video',
  surveillance: 'cctv',
  security_camera: 'cctv',

  // Network
  switch: 'network',
  sw: 'network',
  router: 'router',
  rt: 'router',
  firewall: 'shield',
  fw: 'shield',
  ngfw: 'shield',
  ap: 'wifi',
  access_point: 'wifi',
  wlan: 'wifi',
  hub: 'network-hub',
  tap: 'activity',

  // Compute
  server: 'server',
  srv: 'server',
  vm: 'cpu',
  virtual_machine: 'cpu',
  blade: 'boxes',
  cluster: 'server-rack',
  docker: 'container',
  k8s: 'container',

  // End-user
  workstation: 'workstation',
  pc: 'workstation',
  desktop: 'workstation',
  laptop: 'laptop',
  printer: 'printer',
  mfp: 'printer',
  phone: 'phone',
  voip: 'phone',
  pbx: 'phone-call',

  // Storage
  storage: 'hard-drive',
  san: 'hard-drive',
  nas: 'hard-drive',

  // Power / IoT
  pdu: 'zap',
  ups: 'zap',
  power: 'zap',
  sensor: 'thermometer',
  temp: 'thermometer',
};

/**
 * Resolves an icon name or device type string to a Lucide icon component.
 * Supports exact IDs, synonyms, aliases, and lowercase/uppercase variations.
 */
export function getDeviceIconComponent(iconNameOrCode?: string): LucideIcon {
  if (!iconNameOrCode) return Server;
  const key = iconNameOrCode.toLowerCase().trim();

  // 1. Direct match
  if (DEVICE_ICON_MAP[key]) {
    return DEVICE_ICON_MAP[key];
  }

  // 2. Alias resolution
  const aliasedId = ICON_ALIASES[key];
  if (aliasedId && DEVICE_ICON_MAP[aliasedId]) {
    return DEVICE_ICON_MAP[aliasedId];
  }

  // 3. Substring heuristic
  if (key.includes('cctv') || key.includes('cam')) return Cctv;
  if (key.includes('router') || key.includes('gateway')) return Router;
  if (key.includes('switch')) return Network;
  if (key.includes('firewall') || key.includes('shield')) return Shield;
  if (key.includes('server')) return Server;
  if (key.includes('storage') || key.includes('nas') || key.includes('san')) return HardDrive;
  if (key.includes('print')) return Printer;
  if (key.includes('wifi') || key.includes('access_point')) return Wifi;
  if (key.includes('phone') || key.includes('voip')) return Phone;
  if (key.includes('pdu') || key.includes('ups') || key.includes('power')) return Zap;
  if (key.includes('temp') || key.includes('sensor')) return Thermometer;
  if (key.includes('vm') || key.includes('virtual')) return Cpu;
  if (key.includes('laptop')) return Laptop;
  if (key.includes('workstation') || key.includes('desktop')) return Monitor;

  return Box;
}

/**
 * Renders a device icon JSX element cleanly with fallback.
 */
export function renderDeviceIcon(
  iconNameOrCode?: string,
  className = 'w-5 h-5',
  fallbackIcon?: LucideIcon
): React.ReactElement {
  const IconComp = getDeviceIconComponent(iconNameOrCode) || fallbackIcon || Server;
  return React.createElement(IconComp, { className });
}
