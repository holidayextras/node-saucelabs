import SauceLabs from './..';
import {DEFAULT_OPTIONS, SAUCE_CONNECT_CLI_PARAMS} from '../constants';

export const command = 'sc [flags]';
export const describe = `Sauce Connect Proxy interface.
 - Only the 'sc run' command is currently supported
 - See https://docs.saucelabs.com/dev/cli/sauce-connect-5/run/ for detailed CLI documentation.
 - Sauce Connect Proxy 4.x.x cannot be used with the library version 9.0.0 and newer
 - Some Sauce Connect CLI option aliases differ from the 'sc' binary
 - Some CLI options differ from the 'sc' binary:
   - '--proxy' corresponds to https://docs.saucelabs.com/dev/cli/sauce-connect-5/run/#proxy-sauce
   - '--sc-upstream-proxy' corresponds to https://docs.saucelabs.com/dev/cli/sauce-connect-5/run/#proxy
`;
export const builder = (yargs) => {
  for (const option of SAUCE_CONNECT_CLI_PARAMS) {
    yargs.option(option.name, option);
  }
};
export const handler = async (argv) => {
  const {user, key, region, proxy} = Object.assign({}, DEFAULT_OPTIONS, argv);
  const api = new SauceLabs({user, key, region, proxy});
  return api.startSauceConnect(argv, true);
};
