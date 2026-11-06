/**
 * @file networkInterfaceResolver.js
 * Intelligent Network Interface Discovery & Priority Classifier for Soko.
 *
 * Edge Cases Handled:
 * 1. Docker, Podman, and CNI bridges (docker0, br-*, cni0) ignored to prevent unroutable subnets.
 * 2. Virtual machine hypervisors (virbr0, vnet*, vmnet*, veth*) filtered out.
 * 3. VPN and overlay tunnels (tailscale*, wg*, tun*, tap*) deprioritized or excluded from LAN QR.
 * 4. WSL virtual switches (vEthernet) safely deprioritized.
 * 5. Physical Wi-Fi prioritized over Ethernet for mobile device pairing affinity.
 * 6. Mobile Hotspot AP interfaces detected and highlighted.
 * 7. Candidate IP fallback list ('alts') generated for multi-homed workstation setups.
 */

const os = require('os');

/**
 * Interface type classification.
 * @enum {string}
 */
const InterfaceType = {
  WIFI: 'wifi',
  ETHERNET: 'ethernet',
  HOTSPOT: 'hotspot',
  VIRTUAL: 'virtual',
  LOOPBACK: 'loopback',
  OTHER: 'other',
};

/**
 * Regular expressions to detect virtual, tunnel, or hypervisor interfaces.
 */
const VIRTUAL_NAME_PATTERNS = [
  /^docker\d*$/i,
  /^br-[0-9a-f]{12}$/i,
  /^virbr\d*$/i,
  /^veth[0-9a-f]*$/i,
  /^vnet\d*$/i,
  /^vmnet\d*$/i,
  /^tailscale\d*$/i,
  /^tun\d*$/i,
  /^tap\d*$/i,
  /^wg\d*$/i,
  /^cni\d*$/i,
  /^flannel\d*$/i,
  /^dummy\d*$/i,
  /vEthernet/i,
  /Host-Only/i,
  /VirtualBox/i,
  /VMware/i,
];

/**
 * Determines whether an interface name belongs to a virtual / internal bridge.
 * @param {string} name
 * @returns {boolean}
 */
function isVirtualInterface(name) {
  if (!name) return false;
  return VIRTUAL_NAME_PATTERNS.some((pattern) => pattern.test(name));
}

/**
 * Classifies an interface name into a categorized InterfaceType.
 * @param {string} name
 * @returns {string}
 */
function classifyInterfaceType(name) {
  if (!name) return InterfaceType.OTHER;
  const lower = name.toLowerCase();

  if (isVirtualInterface(name)) {
    return InterfaceType.VIRTUAL;
  }
  if (lower.startsWith('lo') || lower.includes('loopback')) {
    return InterfaceType.LOOPBACK;
  }
  if (lower.includes('ap') || lower.includes('hotspot') || lower.includes('uap')) {
    return InterfaceType.HOTSPOT;
  }
  if (lower.startsWith('wl') || lower.includes('wifi') || lower.includes('wi-fi') || lower.includes('wireless') || lower.startsWith('wlan')) {
    return InterfaceType.WIFI;
  }
  if (lower.startsWith('en') || lower.startsWith('eth') || lower.includes('ethernet')) {
    return InterfaceType.ETHERNET;
  }
  return InterfaceType.OTHER;
}

/**
 * Resolves all active IPv4 network interfaces on the host, filtering out virtual/internal
 * interfaces and ranking them by priority for mobile QR connection.
 *
 * Priority order:
 * 1. Physical Wi-Fi interfaces (highest affinity with mobile phones)
 * 2. Mobile Hotspot / AP interfaces
 * 3. Physical Ethernet interfaces
 * 4. Other physical LAN interfaces
 * 5. Fallback virtual interfaces (only if zero physical interfaces exist)
 *
 * @param {Object} [options]
 * @param {boolean} [options.includeVirtual=false] - Whether to include virtual bridges in fallback list
 * @param {string} [options.preferredIp] - Explicit IP override if configured by user
 * @returns {{
 *   primaryIp: string,
 *   primaryInterface: string|null,
 *   candidateIps: string[],
 *   alts: string,
 *   allInterfaces: Array<{ name: string, address: string, type: string, priority: number }>
 * }}
 */
function resolveNetworkInterfaces(options = {}) {
  const { includeVirtual = false, preferredIp = null } = options;
  const nets = os.networkInterfaces();
  const classified = [];

  for (const [name, addrs] of Object.entries(nets)) {
    for (const net of addrs || []) {
      // Soko connects over IPv4 for zero-config LAN bridges
      if (net.family !== 'IPv4' && net.family !== 4) continue;
      if (net.internal) continue;

      const type = classifyInterfaceType(name);
      let priority = 50;

      switch (type) {
        case InterfaceType.WIFI:
          priority = 100;
          break;
        case InterfaceType.HOTSPOT:
          priority = 90;
          break;
        case InterfaceType.ETHERNET:
          priority = 80;
          break;
        case InterfaceType.OTHER:
          priority = 60;
          break;
        case InterfaceType.VIRTUAL:
          priority = 10;
          break;
        default:
          priority = 20;
      }

      classified.push({
        name,
        address: net.address,
        type,
        priority,
      });
    }
  }

  // Sort interfaces descending by priority
  classified.sort((a, b) => b.priority - a.priority);

  // Separate physical LAN candidates from virtual bridges
  const physicalCandidates = classified.filter((i) => i.type !== InterfaceType.VIRTUAL);
  const effectiveCandidates = physicalCandidates.length > 0 ? physicalCandidates : (includeVirtual ? classified : []);

  let primary = null;

  // Check if user specified an explicit preferred IP that is active
  if (preferredIp) {
    const found = effectiveCandidates.find((c) => c.address === preferredIp);
    if (found) primary = found;
  }

  if (!primary && effectiveCandidates.length > 0) {
    primary = effectiveCandidates[0];
  }

  const primaryIp = primary ? primary.address : '127.0.0.1';
  const primaryInterface = primary ? primary.name : null;

  // Build candidate IP list (unique addresses, primary first)
  const candidateIpsSet = new Set();
  if (primary) candidateIpsSet.add(primary.address);
  for (const c of effectiveCandidates) {
    candidateIpsSet.add(c.address);
  }
  if (candidateIpsSet.size === 0) {
    candidateIpsSet.add('127.0.0.1');
  }

  const candidateIps = Array.from(candidateIpsSet);
  // 'alts' contains all candidate IPs except the primary IP
  const altsList = candidateIps.filter((ip) => ip !== primaryIp);
  const alts = altsList.join(',');

  return {
    primaryIp,
    primaryInterface,
    candidateIps,
    alts,
    allInterfaces: classified,
  };
}

module.exports = {
  InterfaceType,
  isVirtualInterface,
  classifyInterfaceType,
  resolveNetworkInterfaces,
};
