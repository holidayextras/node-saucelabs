import fs from 'fs';
import path from 'path';
import {spawn} from 'child_process';

// https://github.com/import-js/eslint-plugin-import/issues/2352
// eslint-disable-next-line import/no-unresolved
import got from 'got';
import FormData from 'form-data';
import {camelCase} from 'change-case';
import {
  getCPUArch,
  getPlatform,
  createHMAC,
  getAPIHost,
  getAssetHost,
  toString,
  getParameters,
  isValidType,
  createProxyAgent,
  getStrictSsl,
  getRegionSubDomain,
} from './utils';
import queryString from 'query-string';

import {
  PROTOCOL_MAP,
  DEFAULT_OPTIONS,
  SYMBOL_INSPECT,
  SYMBOL_TOSTRING,
  SYMBOL_ITERATOR,
  TO_STRING_TAG,
  SC_PARAMS_TO_STRIP,
  SC_READY_MESSAGE,
  SC_CLOSE_MESSAGE,
  SC_CLOSE_TIMEOUT,
  DEFAULT_SAUCE_CONNECT_VERSION,
  SC_FAILURE_MESSAGES,
  SC_WAIT_FOR_MESSAGES,
  SC_BOOLEAN_CLI_PARAMS,
} from './constants';
import SauceConnectLoader from './sauceConnectLoader';

export default class SauceLabs {
  constructor(options) {
    this._options = Object.assign({}, DEFAULT_OPTIONS, options);
    this.username = this._options.user;
    this._accessKey = this._options.key;
    this._api = got.extend({
      username: this.username,
      password: this._accessKey,
      https: {rejectUnauthorized: getStrictSsl()},
      followRedirect: true,
      headers: {
        ...this._options.headers,
        Authorization: `Basic ${Buffer.from(
          `${this.username}:${this._accessKey}`
        ).toString('base64')}`,
      },
    });

    if (typeof this._options.proxy === 'string') {
      this.proxy = this._options.proxy;
      const proxyAgent = createProxyAgent(this.proxy);
      this._api = got.extend(
        {
          agent: proxyAgent,
        },
        this._api
      );
    }

    /**
     * public fields
     */
    this.region = this._options.region;
    this.tld = this._options.tld;
    this.webdriverEndpoint = `https://ondemand.${getRegionSubDomain(
      options
    )}.saucelabs.com/`;

    return new Proxy(
      {
        username: this.username,
        key: `XXXXXXXX-XXXX-XXXX-XXXX-XXXXXX${(this._accessKey || '').slice(
          -6
        )}`,
        region: this._options.region,
        proxy: this._options.proxy,
        webdriverEndpoint: this.webdriverEndpoint,
        headers: this._options.headers,
      },
      {get: this.get.bind(this)}
    );
  }

  get(_, propName) {
    /**
     * print to string output
     * https://nodejs.org/api/util.html#util_util_inspect_custom
     */
    /* istanbul ignore next */
    if (propName === SYMBOL_INSPECT || propName === 'inspect') {
      return () => toString(this);
    }

    /**
     * print to string tag
     * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/toStringTag
     */
    if (propName === SYMBOL_TOSTRING) {
      return TO_STRING_TAG;
    }

    /**
     * return instance iterator
     * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/iterator
     */
    if (propName === SYMBOL_ITERATOR) {
      return;
    }

    /**
     * provide access to Sauce Connect interface
     */
    if (propName === 'startSauceConnect') {
      return this._startSauceConnect.bind(this);
    }

    /**
     * have special implementations for certain operations
     */
    if (propName === 'uploadJobAssets') {
      return this._uploadJobAssets.bind(this);
    }

    if (propName === 'listBuilds') {
      return this._listBuilds.bind(this);
    }

    if (propName === 'listBuildFailedJobs') {
      return this._listBuildFailedJobs.bind(this);
    }

    if (propName === 'listBuildJobs') {
      return this._listBuildJobs.bind(this);
    }

    if (propName === 'getUserByUsername') {
      return this._getUserByUsername.bind(this);
    }

    /**
     * allow to return publicly registered class properties
     */
    if (this[propName]) {
      return !propName.startsWith('_') ? this[propName] : undefined;
    }

    if (!PROTOCOL_MAP.has(propName)) {
      /**
       * just return if propName is a symbol (Node 8 and lower)
       */
      /* istanbul ignore next */
      if (typeof propName !== 'string') {
        return;
      }
      throw new Error(`Couldn't find API endpoint for command "${propName}"`);
    }

    /**
     * handle special commands not defined in the protocol
     */
    if (propName === 'downloadJobAsset') {
      return this._downloadJobAsset.bind(this);
    }

    return this._callAPI.bind(this, propName);
  }

  async _listBuilds(username, args) {
    const {id: userId} = await this._getUserByUsername({username});
    const params = {userId, ...args};
    const {builds} = await this._callAPI('getBuildsV2', 'vdc', params);
    return builds;
  }

  async _listBuildFailedJobs(username, buildId, args) {
    const {id: userId} = await this._getUserByUsername({username});
    const params = {userId, faulty: true, ...args};
    const {jobs: buildJobs} = await this._callAPI(
      'getBuildsJobsV2',
      'vdc',
      buildId,
      params
    );
    const jobIds = buildJobs.map(({id}) => id);
    const {jobs} = await this._callAPI('getJobsV1_1', {id: jobIds, full: true});
    return jobs;
  }

  async _listBuildJobs(buildId, args) {
    const {jobs: buildJobs} = await this._callAPI(
      'getBuildsJobsV2',
      'vdc',
      buildId,
      args
    );
    const jobIds = buildJobs.map(({id}) => id);
    const {jobs} = await this._callAPI('getJobsV1_1', {
      ...args,
      id: jobIds,
      full: true,
    });
    return jobs;
  }

  async _getUserByUsername({username}) {
    try {
      const {
        results: [user],
      } = await this._callAPI('getUsersV1', {username});
      return user;
    } catch (err) {
      throw new Error(
        `There was an error while fetching user information: ${err.message}`
      );
    }
  }

  async _startSauceConnect(argv, fromCLI) {
    if (!fromCLI) {
      for (const [k, v] of Object.entries(argv)) {
        if (k.includes('-')) {
          continue;
        }
        argv[
          k
            .split(/(?=[A-Z])/)
            .join('-')
            .toLowerCase()
        ] = v;
      }
    }

    const sauceConnectVersion = argv.scVersion || DEFAULT_SAUCE_CONNECT_VERSION;
    const scUpstreamProxy = argv.scUpstreamProxy;
    const args = Object.entries(argv)
      /**
       * filter out yargs, yargs params and custom parameters
       */
      .filter(
        ([k]) =>
          ![
            '_',
            '$0',
            'sc-version',
            'sc-upstream-proxy',
            'logger',
            ...SC_PARAMS_TO_STRIP,
          ].includes(k)
      )
      /**
       * remove duplicate params by yargs
       */
      .filter(([k]) => !k.match(/[A-Z]/g))
      /**
       * SC doesn't like boolean values, so we need to make sure to
       * no pass it along when we deal with a boolean param
       */
      .map(([k, v]) =>
        SC_BOOLEAN_CLI_PARAMS.includes(k) ? `--${k}` : `--${k}=${v}`
      );
    args.push(`--username=${this.username}`);
    args.push(`--access-key=${this._accessKey}`);
    if (scUpstreamProxy) {
      // map `--sc-upstream-proxy` to sc's `--proxy`. It's done because the app CLI
      // conflicts with sc's CLI, `--proxy` here is equivalent to `--proxy-sauce` in sc.
      // See: https://docs.saucelabs.com/dev/cli/sauce-connect-5/run/#proxy
      // See: https://docs.saucelabs.com/dev/cli/sauce-connect-5/run/#proxy and
      // https://docs.saucelabs.com/dev/cli/sauce-connect-5/run/#proxy-sauce
      args.push(`--proxy=${scUpstreamProxy}`);
    }
    if (this.proxy) {
      args.push(`--proxy-sauce=${this.proxy}`);
    }

    const region = argv.region || this.region;
    if (region) {
      const scRegion = getRegionSubDomain({region});
      args.push(`--region=${scRegion}`);
    } else {
      // --region is required for Sauce Connect 5.
      throw new Error('Missing region');
    }
    const scLoader = new SauceConnectLoader({sauceConnectVersion});
    const isDownloaded = await scLoader.verifyAlreadyDownloaded();
    if (!isDownloaded) {
      let sauceConnectURL = await this._getSauceConnectDownloadURL(
        sauceConnectVersion
      );
      await scLoader.verifyAlreadyDownloaded({url: sauceConnectURL});
    }
    if (args.length == 0 || args[0] != 'run') {
      args.unshift('run');
    }
    const cp = spawn(scLoader.path, args);
    return new Promise((resolve, reject) => {
      const close = () =>
        new Promise((resolveClose) => {
          process.kill(cp.pid, 'SIGINT');
          const timeout = setTimeout(resolveClose, SC_CLOSE_TIMEOUT);
          cp.stdout.on('data', (data) => {
            const output = data.toString();
            if (output.includes(SC_CLOSE_MESSAGE)) {
              clearTimeout(timeout);
              return resolveClose(returnObj);
            }
          });
        });
      const returnObj = {cp, close};

      cp.stderr.on('data', (data) => {
        const output = data.toString();

        /**
         * check if error output is just an escape sequence or
         * other expected data
         */
        if (
          SC_WAIT_FOR_MESSAGES.find((msg) =>
            escape(output).includes(escape(msg))
          )
        ) {
          return;
        }

        return reject(new Error(output));
      });
      cp.stdout.on('data', (data) => {
        const logger = fromCLI
          ? process.stdout.write.bind(process.stdout)
          : argv.logger;
        const output = data.toString();
        /**
         * print to stdout if called via CLI
         */
        if (typeof logger === 'function') {
          logger(output);
        }

        /**
         * fail if SauceConnect could not establish a connection
         */
        if (
          SC_FAILURE_MESSAGES.find((msg) =>
            escape(output).includes(escape(msg))
          )
        ) {
          return reject(new Error(output));
        }

        /**
         * continue if connection was established
         */
        if (output.includes(SC_READY_MESSAGE)) {
          return resolve(returnObj);
        }
      });

      process.on('SIGINT', close);
      return returnObj;
    });
  }

  async _getSauceConnectDownloadURL(sauceConnectVersion) {
    const platform = getPlatform();
    const cpuARCH = getCPUArch();
    const scVersionInfo = await this._callAPI('scVersions', {
      client_host: `${platform}-${cpuARCH}`,
      client_version: sauceConnectVersion,
    });
    if (!scVersionInfo.download_url) {
      throw new Error('Failed to retrieve Sauce Connect download URL');
    }
    return scVersionInfo.download_url;
  }

  async _downloadJobAsset(jobId, assetName, {filepath} = {}) {
    /**
     * check job id
     */
    if (typeof jobId !== 'string' || typeof assetName !== 'string') {
      throw new Error(
        'You need to define a job id and the file name of the asset as a string'
      );
    }

    const hmac = await createHMAC(this.username, this._accessKey, jobId);
    const host = getAssetHost(this._options);
    const responseType = assetName.endsWith('mp4') ? 'buffer' : 'text';
    const uri = `${host}/jobs/${jobId}/${assetName}?ts=${Date.now()}&auth=${hmac}`;

    try {
      const res = await this._api.get(uri, {responseType});

      /**
       * parse asset as json if proper content type is given
       */
      if (
        res.headers['content-type'] === 'application/json' &&
        typeof res.body === 'string'
      ) {
        res.body = JSON.parse(res.body);
      }

      /**
       * only pipe asset to file if path is given
       */
      if (typeof filepath === 'string') {
        let data = res.body;
        const downloadPath = path.resolve(process.cwd(), filepath);
        const encoding =
          res.headers['content-type'] === 'application/json'
            ? 'utf8'
            : 'binary';

        if (res.headers['content-type'] === 'application/json') {
          data = JSON.stringify(res.body, null, 4);
        }

        fs.writeFileSync(downloadPath, data, {encoding});
      }

      return res.body;
    } catch (err) {
      throw new Error(
        `There was an error downloading asset ${assetName}: ${err.message}`
      );
    }
  }

  async _uploadJobAssets(jobId, {files = []} = {}) {
    if (files.length === 0) {
      throw new Error('No files to upload selected');
    }

    const {servers, basePath, method, endpoint} =
      PROTOCOL_MAP.get('uploadJobAssets');
    const uri =
      getAPIHost(servers, basePath, this._options) +
      endpoint.replace('{jobId}', jobId);
    const body = new FormData();

    for (const file of files) {
      if (typeof file === 'string') {
        const filename = file.startsWith('/')
          ? file
          : path.join(process.cwd(), file);
        const readStream = fs.createReadStream(filename);
        const stats = await fs.promises.stat(filename);

        body.append('file[]', readStream, {
          filename: path.basename(file),
          filepath: filename,
          contentType: 'text/plain',
          knownLength: stats.size,
        });
      } else if (
        file &&
        typeof file.filename === 'string' &&
        Buffer.isBuffer(file.data)
      ) {
        body.append('file[]', file.data, file.filename);
      } else if (file && typeof file.filename === 'string') {
        body.append(
          'file[]',
          Buffer.from(JSON.stringify(file.data)),
          file.filename
        );
      } else {
        throw new Error(
          'Invalid file parameter! Expected either a file path or a file object containing "filename" and "data" property.'
        );
      }
    }

    try {
      const res = await this._api(uri, {method, body});

      /**
       * parse asset as json if proper content type is given
       */
      if (
        res.headers['content-type'] === 'application/json' &&
        typeof res.body === 'string'
      ) {
        res.body = JSON.parse(res.body);
      }

      return res.body;
    } catch (err) {
      throw new Error(`There was an error uploading assets: ${err.message}`);
    }
  }

  async _callAPI(propName, ...args) {
    const {description, method, endpoint, servers, basePath} =
      PROTOCOL_MAP.get(propName);
    const params = getParameters(description.parameters);
    const pathParams = params.filter((p) => p.in === 'path');

    /**
     * validate required url params
     */
    let url = endpoint;
    for (const [i, urlParam] of Object.entries(pathParams)) {
      const param = args[i];
      const type = urlParam.type.replace('integer', 'number');

      if (typeof param !== type) {
        throw new Error(
          `Expected parameter for url param '${
            urlParam.name
          }' from type '${type}', found '${typeof param}'`
        );
      }

      url = url.replace(`{${urlParam.name}}`, param);
    }

    /**
     * check for body param (as last parameter as we don't expect request
     * parameters for non idempotent requests)
     */
    let bodyOption =
      params.find((p) => p.in === 'body') || description.requestBody
        ? args[pathParams.length]
        : null;

    if (bodyOption && typeof bodyOption === 'string') {
      bodyOption = JSON.parse(bodyOption);
    }

    /**
     * validate required options
     */
    const bodyMap = new Map();
    const options = args.slice(pathParams.length)[0] || {};
    for (const optionParam of params.filter((p) => p.in === 'query')) {
      const expectedType = optionParam.type.replace('integer', 'number');
      // support query options passed in camelCased form.
      const optionName = camelCase(optionParam.name);
      let optionValueFromParams = options[optionName];
      if (
        optionParam.name !== optionName &&
        typeof optionValueFromParams === 'undefined'
      ) {
        optionValueFromParams = options[optionParam.name];
      }
      const optionValue = optionValueFromParams;
      const isRequired =
        Boolean(optionParam.required) ||
        (typeof optionParam.required === 'undefined' &&
          typeof optionParam.default === 'undefined');
      if (
        (isRequired || optionValue) &&
        !isValidType(optionValue, expectedType)
      ) {
        throw new Error(
          `Expected parameter for option '${optionName}' from type '${expectedType}', found '${typeof optionValue}'`
        );
      }

      if (typeof optionValue !== 'undefined') {
        bodyMap.set(optionParam.name, optionValue);
      }
    }

    /**
     * get request body by using the body parameter or convert the parameter
     * map into json object
     */
    const body =
      bodyOption ||
      [...bodyMap.entries()].reduce((e, [k, v]) => {
        e[k] = v;
        return e;
      }, {});

    /**
     * stringify queryParams if stringifyOptions exists within description
     */
    const modifiedParams = description.stringifyOptions
      ? queryString.stringify(body, description.stringifyOptions)
      : body;

    /**
     * make request
     */
    const uri = getAPIHost(servers, basePath, this._options) + url;
    try {
      const response = await this._api[method](uri, {
        ...(method === 'get'
          ? {searchParams: modifiedParams}
          : {json: modifiedParams}),
        responseType: 'json',
      });
      return response.body;
    } catch (err) {
      throw new Error(
        `Failed calling ${propName}: ${err.message}, ${
          err.response && JSON.stringify(err.response.body)
        }`
      );
    }
  }
}
