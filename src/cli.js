import yargs from 'yargs';
import {
  USAGE,
  CLI_PARAMS,
  EPILOG,
  PROTOCOL_MAP,
  DEFAULT_OPTIONS,
  SAUCE_VERSION_NOTE,
} from './constants';
import {getParameters} from './utils';
import SauceLabs from './';

export const run = () => {
  let argv = yargs
    .usage(USAGE)
    .epilog(EPILOG)
    .demandCommand()
    .commandDir('commands')
    .wrap(yargs.terminalWidth())
    .help()
    .version(SAUCE_VERSION_NOTE);

  for (const [commandName, options] of PROTOCOL_MAP) {
    const params = getParameters(options.description.parameters);
    const command = `${commandName} ${params
      .map((p) => (p.required ? `<${p.name}>` : `[${p.name}]`))
      .join(' ')}`;

    const description =
      options.description.summary ||
      options.description.description ||
      'Unknown description';
    yargs.command(
      command.trim(),
      description,
      (yargs) => {
        for (const param of params) {
          const paramDescription = {
            describe: param.description,
            type: param.type,
          };

          if (typeof param.default !== 'undefined') {
            paramDescription.default = param.default;
          }

          yargs.positional(param.name, paramDescription);
        }
      },
      async (argv) => {
        const {user, key, region, proxy, tld} = Object.assign(
          {},
          DEFAULT_OPTIONS,
          argv
        );
        const api = new SauceLabs({user, key, region, proxy, tld});
        const requiredParams = params
          .filter((p) => p.required)
          .map((p) => argv[p.name]);

        try {
          const result = await api[commandName](...requiredParams, argv);

          if (typeof result === 'object') {
            // eslint-disable-next-line no-console
            return console.log(JSON.stringify(result, null, 4));
          }

          // eslint-disable-next-line no-console
          console.log(result);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error(error);
          return process.exit(1);
        }

        /**
         * only return for testing purposes
         */
        if (process.env.JEST_WORKER_ID) {
          return api;
        }
      }
    );
  }

  /**
   * populate cli arguments
   */
  for (const param of CLI_PARAMS) {
    argv = argv.option(param.name, param);
  }

  return argv.argv;
};
