import {camelCase} from 'change-case';
import os from 'os';

import {version} from '../package.json';

export const DEFAULT_SAUCE_CONNECT_VERSION = '4.9.1';
export const SAUCE_CONNECT_BASE = 'https://saucelabs.com/downloads';
export const SAUCE_CONNECT_VERSIONS_ENDPOINT =
  'https://saucelabs.com/versions.json';
export const SAUCE_CONNECT_PLATFORM_DATA = {
  darwin: {
    url: `${SAUCE_CONNECT_BASE}/sc-%s-osx.zip`,
    use: 'bin/sc',
  },
  linux: {
    url: `${SAUCE_CONNECT_BASE}/sc-%s-linux.tar.gz`,
    use: 'bin/sc',
  },
  win32: {
    url: `${SAUCE_CONNECT_BASE}/sc-%s-win32.zip`,
    use: 'bin/sc',
  },
};

export const SAUCE_VERSION_NOTE = `node-saucelabs v${version}\nSauce Connect v${DEFAULT_SAUCE_CONNECT_VERSION}`;

const protocols = [
  require('../apis/sauce.json'),
  require('../apis/performance.json'),
  require('../apis/testcomposer.json'),
  require('../apis/datastore.json'),
  require('../apis/autonomiq.json'),
  require('../apis/teamManagement.json'),
  require('../apis/builds.json'),
  require('../apis/testruns.json'),
];

const protocolFlattened = new Map();
const parametersFlattened = new Map();
for (const {paths, parameters, basePath, servers} of protocols) {
  for (const [name, description] of Object.entries(parameters || {})) {
    parametersFlattened.set(name, description);
  }

  for (const [endpoint, methods] of Object.entries(paths)) {
    for (const [method, description] of Object.entries(methods)) {
      let commandName = camelCase(description.operationId);
      /**
       * mark commands as deprecated in the command names
       */
      if (description.deprecated) {
        commandName += 'Deprecated';
      }

      /**
       * ensure we don't double register commands
       */
      /* istanbul ignore if */
      if (protocolFlattened.has(commandName)) {
        throw new Error(`command ${commandName} already registered`);
      }

      protocolFlattened.set(commandName, {
        method,
        endpoint,
        description,
        servers,
        basePath,
      });
    }
  }
}

export const PROTOCOL_MAP = protocolFlattened;
export const PARAMETERS_MAP = parametersFlattened;
export const JOB_ASSET_NAMES = [
  'console.json',
  'performance.json',
  'automator.log',
  'selenium-server.log',
  'log.json',
  'logcat.log',
  'video.mp4',
];

export const DEFAULT_OPTIONS = {
  user: process.env.SAUCE_USERNAME,
  key: process.env.SAUCE_ACCESS_KEY,
  region: 'us',
  proxy: process.env.HTTPS_PROXY || process.env.HTTP_PROXY,
  headers: {'User-Agent': `saucelabs/v${version} (nodejs ${os.platform()})`},
};

export const ASSET_REGION_MAPPING = {
  us: '',
  eu: 'eu-central-1.',
  'us-west-1': '',
  'us-east-4': 'us-east-4.',
  'eu-central-1': 'eu-central-1.',
  staging: 'staging.',
};

export const SYMBOL_INSPECT = Symbol.for('nodejs.util.inspect.custom');
export const SYMBOL_TOSTRING = Symbol.toStringTag;
export const SYMBOL_ITERATOR = Symbol.iterator;
export const TO_STRING_TAG = 'SauceLabs API Client';

export const USAGE = `Sauce Labs API CLI

Usage: sl <command> [options]`;

export const EPILOG = `Copyright ${new Date().getUTCFullYear()} © Sauce Labs`;

export const CLI_PARAMS = [
  {
    alias: 'h',
    name: 'help',
    description: 'prints help menu',
  },
  {
    alias: 'u',
    name: 'user',
    description: 'your Sauce Labs username',
  },
  {
    alias: 'k',
    name: 'key',
    description: 'your Sauce Labs user key',
  },
  {
    alias: 'r',
    name: 'region',
    default: DEFAULT_OPTIONS.region,
    description:
      'your Sauce Labs datacenter region, the following regions are available: `us-west-1` (short `us`), `eu-central-1` (short `eu`)',
  },
  {
    alias: 'p',
    name: 'proxy',
    description:
      'use a proxy for fetching data instead of environment variables',
    default: DEFAULT_OPTIONS.proxy,
  },
];
const CLI_PARAM_KEYS = CLI_PARAMS.map((param) => param.name);
const CLI_PARAM_ALIASES = CLI_PARAMS.map((param) => param.alias).filter(
  Boolean
);

export const SAUCE_CONNECT_CLI_PARAMS = [
  {
    /**
     * custom parameter
     */
    name: 'sc-version',
    description: 'Specify the Sauce Connect version you want to use.',
    default: DEFAULT_SAUCE_CONNECT_VERSION,
  },
  {
    /**
     * Sauce Connect parameter
     */
    alias: 'a',
    name: 'auth',
    description:
      'Perform basic authentication when an URL on <host:port> asks for a username and password.',
  },
  {
    name: 'cainfo',
    description:
      'CA certificate bundle to use for verifying REST connections. (default "/usr/local/etc/openssl/cert.pem")',
  },
  {
    name: 'capath',
    description:
      'Directory of CA certs to use for verifying REST connections. (default "/etc/ssl/certs")',
    deprecated: true,
  },
  {
    alias: 'c',
    name: 'config-file',
    description: 'Path to YAML config file.',
  },
  {
    alias: 'D',
    name: 'direct-domains',
    description:
      'Comma-separated list of domains. Requests whose host matches one of these will be relayed directly through the internet, instead of through the tunnel.',
  },
  {
    name: 'dns',
    description:
      'Use specified name server(s). Example: --dns 8.8.8.8,8.8.4.4:53',
  },
  {
    name: 'doctor',
    description:
      'Perform checks to detect possible misconfiguration or problems.',
    type: 'boolean',
    deprecated: true,
  },
  {
    alias: 'F',
    name: 'fast-fail-regexps',
    description:
      'Comma-separated list of regular expressions. Requests matching one of these will get dropped instantly and will not go through the tunnel.',
  },
  {
    alias: 'z',
    name: 'log-stats',
    description: 'Log statistics about HTTP traffic every <seconds>.',
    type: 'number',
    deprecated: true,
  },
  {
    alias: 'l',
    name: 'logfile',
    description: 'Specify custom logfile.',
  },
  {
    name: 'max-logsize',
    description:
      'Rotate logfile after reaching <bytes> size. Disabled by default.',
    type: 'number',
  },
  {
    alias: 'M',
    name: 'max-missed-acks',
    description:
      'The max number of keepalive acks that can be missed before triggering reconnect.',
    type: 'number',
    deprecated: true,
  },
  {
    name: 'metrics-address',
    description: 'host:port server used to expose client-side metrics.',
    deprecated: true,
  },
  {
    name: 'status-address',
    description: 'host:port server used to expose client status.',
  },
  {
    name: 'no-autodetect',
    description: 'Disable the autodetection of proxy settings.',
    type: 'boolean',
  },
  {
    alias: 'N',
    name: 'no-proxy-caching',
    description:
      'Disable caching in Sauce Connect. All requests will be sent through the tunnel.',
    type: 'boolean',
    deprecated: true,
  },
  {
    name: 'no-remove-colliding-tunnels',
    description:
      "Don't remove identified tunnels with the same name, or any other default tunnels if this is a default tunnel. Jobs will be distributed between these tunnels, enabling load balancing and high availability. By default, colliding tunnels will be removed when Sauce Connect is starting up.",
    type: 'boolean',
    deprecated: true,
  },
  {
    alias: 'B',
    name: 'no-ssl-bump-domains',
    description:
      'Comma-separated list of domains. Requests whose host matches one of these will not be SSL re-encrypted.',
  },
  {
    name: 'pac',
    description:
      'Proxy autoconfiguration. Can be an http(s) or local file:// (absolute path only) URI.',
  },
  {
    alias: 'd',
    name: 'pidfile',
    description: 'File that will be created with the pid of the process.',
  },
  {
    alias: 'T',
    name: 'proxy-tunnel',
    description: 'Use the proxy configured with -p for the tunnel connection.',
    type: 'boolean',
  },
  {
    alias: 'w',
    name: 'proxy-userpwd',
    description:
      'Username and password required to access the proxy configured with -p.',
  },
  {
    alias: 'f',
    name: 'readyfile',
    description: 'File that will be touched to signal when tunnel is ready.',
  },
  {
    alias: 'X',
    name: 'scproxy-port',
    description: 'Port on which scproxy will be listening.',
  },
  {
    name: 'scproxy-read-limit',
    description:
      'Rate limit reads in scproxy to X bytes per second. This option can be used to adjust local network transfer rate in order not to overload the tunnel connection.',
    deprecated: true,
  },
  {
    name: 'scproxy-write-limit',
    description:
      'Rate limit writes in scproxy to X bytes per second. This option can be used to adjust local network transfer rate in order not to overload the tunnel connection.',
    deprecated: true,
  },
  {
    alias: 'P',
    name: 'se-port',
    description:
      "Port on which Sauce Connect's Selenium relay will listen for requests. Selenium commands reaching Connect on this port will be relayed to Sauce Labs securely and reliably through Connect's tunnel (default 4445)",
    type: 'number',
    default: 4445,
  },
  {
    alias: 's',
    name: 'shared-tunnel',
    description:
      'Let sub-accounts of the tunnel owner use the tunnel if requested.',
    type: 'boolean',
  },
  {
    name: 'tunnel-cainfo',
    description:
      'CA certificate bundle to use for verifying tunnel connections. (default "/usr/local/etc/openssl/cert.pem")',
  },
  {
    name: 'tunnel-capath',
    description:
      'Directory of CA certs to use for verifying tunnel connections. (default "/etc/ssl/certs")',
    deprecated: true,
  },
  {
    name: 'tunnel-cert',
    description:
      'Specify certificate to use for the tunnel connection, either public or private. Default: private. (default "private")',
  },
  {
    alias: 't',
    name: 'tunnel-domains',
    description:
      "Inverse of '--direct-domains'. Only requests for domains in this list will be sent through the tunnel. Overrides '--direct-domains'.",
  },
  {
    name: 'tunnel-identifier',
    description:
      'Tunnel name used for this tunnel or the tunnels in the same HA pool.',
    deprecated: true,
  },
  {
    alias: 'i',
    name: 'tunnel-name',
    description:
      'Tunnel name used for this tunnel or the tunnels in the same HA pool.',
  },
  {
    name: 'tunnel-pool',
    description: 'The tunnel is a part of a high availability tunnel pool.',
  },
  {
    alias: 'v',
    name: 'verbose',
    type: 'boolean',
    description: 'Enable verbose logging. Can be used up to two times.',
  },
];
export const SC_BOOLEAN_CLI_PARAMS = SAUCE_CONNECT_CLI_PARAMS.filter(
  (p) => p.type === 'boolean'
).map((p) => p.name);

const SAUCE_CONNECT_CLI_PARAM_ALIASES = SAUCE_CONNECT_CLI_PARAMS.map(
  (param) => param.alias
).filter(Boolean);
export const SC_CLI_PARAM_KEYS = SAUCE_CONNECT_CLI_PARAMS.map(
  (param) => param.name
);
export const SC_PARAMS_TO_STRIP = [
  ...CLI_PARAM_KEYS,
  ...CLI_PARAM_ALIASES,
  ...SAUCE_CONNECT_CLI_PARAM_ALIASES,
];

export const SC_READY_MESSAGE = 'Sauce Connect is up, you may start your tests';
export const SC_FAILURE_MESSAGES = [
  'Sauce Connect could not establish a connection',
  'Sauce Connect failed to start',
];
export const SC_WAIT_FOR_MESSAGES = ['\u001b[K', 'Please wait for']; // "\u001b" = Escape character
export const SC_CLOSE_MESSAGE = 'Goodbye';
export const SC_CLOSE_TIMEOUT = 5000;
