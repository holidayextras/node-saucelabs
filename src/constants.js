import {camelCase} from 'change-case';
import os from 'os';

import {version} from '../package.json';

export const DEFAULT_SAUCE_CONNECT_VERSION = '5.2.0';
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
    alias: 'c',
    name: 'config-file',
    description: 'Path to YAML config file.',
  },
  {
    alias: 'i',
    name: 'tunnel-name',
    description:
      'Tunnel name used for this tunnel or the tunnels in the same HA pool.',
  },
  {
    alias: 'M',
    name: 'metadata',
    description:
      'Custom metadata key-value pairs. This flag is, primarily, used by Sauce Labs to assign custom properties to the tunnel for reporting purposes.',
  },
  {
    alias: 's',
    name: 'shared',
    description:
      "Share the tunnel within the same org unit. Only the 'all' option is currently supported. See here: https://docs.saucelabs.com/basics/acct-team-mgmt/sauce-connect-proxy-tunnels/.",
  },
  {
    alias: 't',
    name: 'tunnel-pool',
    type: 'boolean',
    description:
      'Denotes a tunnel as part of a high availability tunnel pool. See here: https://docs.saucelabs.com/secure-connections/sauce-connect/setup-configuration/high-availability/.',
  },
  {
    alias: 'F',
    name: 'deny-domains',
    description:
      "Deny requests to the matching domains. Prefix domains with '-' to exclude requests from being denied. Special keyword 'all' matches all domains.",
  },
  {
    alias: 'D',
    name: 'direct-domains',
    description:
      "Forward matching requests to their origin server over the public internet. Requests that don't match \"direct domains\" will be forwarded to customer-side over the Sauce Connect Proxy connection. You can specify --direct-domains or --tunnel-domains, but not both. Prefix domains with '-' to exclude requests from being forwarded directly.",
  },
  {
    alias: 'B',
    name: 'tls-passthrough-domains',
    description:
      "Pass matching requests to their origin server without SSL/TLS re-encryption. Requests that don't match will be re-encrypted. You can specify --tls-passthrough-domains or --tls-resign-domains, but not both. Prefix domains with '-' to exclude requests from being passed through.",
  },
  {
    alias: 'b',
    name: 'tls-resign-domains',
    description:
      "Resign SSL/TLS certificates for matching requests. You can specify --tls-resign-domains or --tls-passthrough-domains, but not both. Prefix domains with '-' to exclude requests from being resigned.",
  },
  {
    alias: 'T',
    name: 'tunnel-domains',
    description:
      "Forward matching requests over the Sauce Connect Proxy connection. Requests not matching \"tunnel domains\" will be forwarded to their origin server over the public internet. You can specify --tunnel-domains or --direct-domains, but not both. Prefix domains with '-' to exclude requests from being forwarded over the SC Proxy connection. Special keyword 'all' matches all domains.",
  },
  {
    alias: 'a',
    name: 'auth',
    description: 'Site or upstream proxy basic authentication credentials.',
  },
  {
    name: 'pac',
    description:
      'Proxy Auto-Configuration file to use for upstream proxy selection.',
  },
  {
    name: 'sc-upstream-proxy',
    description:
      'Upstream proxy for test sessions . It is used for requests received from the Sauce Connect Server only.',
  },
  {
    name: 'proxy-localhost',
    description:
      'Setting this to "allow" enables sending requests to localhost through the upstream proxy. Setting this to "direct" sends requests to localhost directly without using the upstream proxy. By default, requests to localhost are denied.',
  },
  {
    name: 'proxy-sauce',
    description:
      'Establish a tunnel through an upstream proxy. Proxy for requests to Sauce Labs REST API and Sauce Connect servers only. See the -x, --proxy flag for more details on the format.',
  },
  {
    name: 'dns-round-robin',
    description:
      'If more than one DNS server is specified with the --dns-server flag, passing this flag will enable round-robin selection.',
  },
  {
    alias: 'n',
    name: 'dns-server',
    description:
      'DNS server(s) to use instead of system default. There are two execution policies, when more then one server is specified. Fallback: the first server in a list is used as primary, the rest are used as fallbacks. Round robin: the servers are used in a round-robin fashion. The port is optional, if not specified the default port is 53.',
  },
  {
    name: 'dns-timeout',
    description:
      'Timeout for dialing DNS servers. Only used if DNS servers are specified.',
  },
  {
    name: 'cacert-file',
    description:
      'Add your own CA certificates to verify against. The system root certificates will be used in addition to any certificates in this list. Use this flag multiple times to specify multiple CA certificate files.',
  },
  {
    name: 'http-dial-timeout',
    description:
      'The maximum amount of time a dial will wait for a connect to complete. With or without a timeout, the operating system may impose its own earlier timeout. For instance, TCP timeouts are often around 3 minutes.',
  },
  {
    name: 'http-idle-conn-timeout',
    description:
      'The maximum amount of time an idle (keep-alive) connection will remain idle before closing itself. Zero means no limit.',
  },
  {
    name: 'http-response-header-timeout',
    description:
      "The amount of time to wait for a server's response headers after fully writing the request (including its body, if any).This time does not include the time to read the response body. Zero means no limit.",
  },
  {
    name: 'http-tls-handshake-timeout',
    description:
      'The maximum amount of time waiting to wait for a TLS handshake. Zero means no limit.',
  },
  {
    name: 'http-tls-keylog-file',
    description:
      'File to log TLS master secrets in NSS key log format. By default, the value is taken from the SSLKEYLOGFILE environment variable. It can be used to allow external programs such as Wireshark to decrypt TLS connections.',
  },
  {
    name: 'api-address',
    description:
      'The server address to listen on. If the host is empty, the server will listen on all available interfaces.',
  },
  {
    name: 'api-basic-auth',
    description: 'Basic authentication credentials to protect the server.',
  },
  {
    name: 'api-idle-timeout',
    description:
      'The maximum amount of time to wait for the next request before closing connection.',
  },
  {
    name: 'log-file',
    description: 'Path to the log file, if empty, logs to stdout.',
  },
  {
    name: 'log-http',
    description: 'HTTP request and response logging mode.',
  },
  {
    name: 'log-level',
    description: 'Log level.',
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
