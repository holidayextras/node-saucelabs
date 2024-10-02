// https://github.com/import-js/eslint-plugin-import/issues/2352
// eslint-disable-next-line import/no-unresolved
import got from 'got';
import util from 'util';
import {spawn} from 'child_process';
import FormData from 'form-data';

import SauceLabs from '../src';

import versions from './__responses__/versions.json';
import allVersions from './__responses__/all_versions.json';
import latestVersions from './__responses__/latest_versions.json';

const instances = [];

jest.mock('fs');
const fs = require('fs');
fs.promises = {
  stat: jest.fn().mockReturnValue(Promise.resolve({size: 123})),
};

jest.mock('child_process', () => {
  const EventEmitter = require('events');
  const stdoutEmitter = new EventEmitter();
  const stderrEmitter = new EventEmitter();
  const spawnMock = {
    pid: 123,
    stderr: stderrEmitter,
    stdout: stdoutEmitter,
    on: jest.fn(),
  };
  const spawn = jest.fn().mockReturnValue(spawnMock);
  return {spawn};
});

jest.mock('../src/sauceConnectLoader.js', () => {
  class SauceConnectLoaderMock {
    constructor() {
      (this.verifyAlreadyDownloaded = jest
        .fn()
        .mockReturnValue(Promise.resolve())),
        (this.path = '/foo/bar');
      instances.push(this);
    }
  }

  return SauceConnectLoaderMock;
});

const stdoutEmitter = spawn().stdout;
const stderrEmitter = spawn().stderr;
const origKill = process.kill;
beforeEach(() => {
  spawn.mockClear();
  process.kill = jest.fn();
  // clean instances array
  instances.splice(0, instances.length);
});
test('should be inspectable', () => {
  const api = new SauceLabs({user: 'foo', key: 'bar'});
  /**
   * we can't use snapshotting here as the result varies
   * between different node versions
   */
  expect(util.inspect(api)).toContain(`{
  username: 'foo',
  key: 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXbar',
  region: 'us',
  proxy: undefined`);
});

test('should expose a webdriverEndpoint', () => {
  const api = new SauceLabs({user: 'foo', key: 'bar'});
  expect(api.webdriverEndpoint).toBe(
    'https://ondemand.us-west-1.saucelabs.com/'
  );

  const api2 = new SauceLabs({user: 'foo', key: 'bar', region: 'eu'});
  expect(api2.webdriverEndpoint).toBe(
    'https://ondemand.eu-central-1.saucelabs.com/'
  );

  const api3 = new SauceLabs({
    user: 'foo',
    key: 'bar',
    region: 'us-east-4',
  });
  expect(api3.webdriverEndpoint).toBe(
    'https://ondemand.us-east-4.saucelabs.com/'
  );

  const api4 = new SauceLabs({user: 'foo', key: 'bar', region: 'us-central-3'});
  expect(api4.webdriverEndpoint).toBe(
    'https://ondemand.us-central-3.saucelabs.com/'
  );
});

test('should have to string tag', () => {
  expect(
    Object.prototype.toString.call(new SauceLabs({user: 'foo', key: 'bar'}))
  ).toBe('[object SauceLabs API Client]');
});

test('should not provide an iterator', () => {
  const api = new SauceLabs({user: 'foo', key: 'bar'});
  expect(() => [...api]).toThrow('is not iterable');
});

test('should return public properties', () => {
  const api = new SauceLabs({user: 'foo', key: 'bar'});
  expect(api.region).toBe('us');
  expect(api.username).toBe('foo');
  expect(api._accessKey).toBe(undefined);
});

test('should return nothing if Symbol was accessed', () => {
  const sym = Symbol('foo');
  const api = new SauceLabs({user: 'foo', key: 'bar'});
  expect(typeof api[sym]).toBe('undefined');
});

test('should grab username and access key from env variable', () => {
  jest.resetModules();
  process.env.SAUCE_USERNAME = 'barfoo';
  process.env.SAUCE_ACCESS_KEY = 'foobar';
  const SauceLabsNew = require('../src').default;
  const api = new SauceLabsNew();
  expect(util.inspect(api)).toContain("username: 'barfoo'");
  expect(util.inspect(api)).toContain(
    "key: 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXfoobar'"
  );
});

test('should grab http proxy from env variable', () => {
  jest.resetModules();
  process.env.HTTP_PROXY = 'http://my.proxy.com:8080';
  const SauceLabsNew = require('../src').default;
  const api = new SauceLabsNew();
  expect(util.inspect(api)).toMatch(/proxy: '??http:\/\/my\.proxy\.com:8080/);
  delete process.env.HTTP_PROXY;
});

test('should grab https proxy from env variable', () => {
  jest.resetModules();
  process.env.HTTPS_PROXY = 'https://my.proxy.com:443';
  const SauceLabsNew = require('../src').default;
  const api = new SauceLabsNew();
  expect(util.inspect(api)).toMatch(/proxy: '??https:\/\/my\.proxy\.com:443/);
});

test('should throw if API command is unknown', () => {
  const api = new SauceLabs({user: 'foo', key: 'bar'});
  expect(() => api.doSomethingCool(123, {foo: 'bar'})).toThrow(
    'Couldn\'t find API endpoint for command "doSomethingCool"'
  );
});

test('should allow to call an API method with param in url', async () => {
  const api = new SauceLabs({user: 'foo', key: 'bar'});
  await api.getUserConcurrency('someuser');
  expect(got.mock.calls[0][0]).toBe(
    'https://api.us-west-1.saucelabs.com/rest/v1.2/users/someuser/concurrency'
  );
});

test('should allow to call an API method with param as option', async () => {
  const api = new SauceLabs({user: 'foo', key: 'bar'});
  await api.listJobs('someuser', {
    limit: 123,
    full: true,
  });

  const uri = got.mock.calls[0][0];
  const req = got.mock.calls[0][1];
  expect(uri).toBe(
    'https://api.us-west-1.saucelabs.com/rest/v1.1/someuser/jobs'
  );
  expect(req.searchParams).toEqual({
    limit: 123,
    full: true,
  });
});

test('should allow to make a request with body param', async () => {
  const api = new SauceLabs({user: 'foo', key: 'bar'});
  await api.updateJob('foobaruser', '690c5877710c422d8be4c622b40c747f', {
    passed: true,
  });

  const req = got.mock.calls[0][1];
  expect(got.put).toBeCalled();
  expect(req.json).toEqual({passed: true});
});

test('should allow to make a request with body param via CLI call', async () => {
  const api = new SauceLabs({user: 'foo', key: 'bar'});
  await api.updateJob(
    'foobaruser',
    '690c5877710c422d8be4c622b40c747f',
    '{ "passed": false }'
  );

  const req = got.mock.calls[0][1];
  expect(got.put).toBeCalled();
  expect(req.json).toEqual({passed: false});
});

test('should fail if param has wrong type', async () => {
  const api = new SauceLabs({user: 'foo', key: 'bar'});
  const error = await api
    .listJobs(123, {
      limit: 123,
      full: true,
    })
    .catch((err) => err);
  expect(error.message).toBe(
    "Expected parameter for url param 'username' from type 'string', found 'number'"
  );
});

test('should fail if option has wrong type', async () => {
  const api = new SauceLabs({user: 'foo', key: 'bar'});
  const error = await api
    .listJobs('someuser', {
      limit: '123',
      full: true,
    })
    .catch((err) => err);
  expect(error.message).toBe(
    "Expected parameter for option 'limit' from type 'number', found 'string'"
  );
});

test('should handle error case', async () => {
  const response = new Error('Not Found');
  response.statusCode = 404;
  response.body = {message: 'Not Found'};
  got.get.mockReturnValueOnce(Promise.reject(response));
  const api = new SauceLabs({user: 'foo', key: 'bar'});
  const error = await api
    .listJobs('someuser', {
      limit: 123,
      full: true,
    })
    .catch((err) => err);
  expect(error.message).toContain('Failed calling listJobs: Not Found');
});

test('should be able to download assets', async () => {
  const api = new SauceLabs({user: 'foo', key: 'bar'});
  await api.downloadJobAsset('some-id', 'performance.json');
  const uri = got.get.mock.calls[0][0];
  expect(uri).toContain(
    'https://assets.saucelabs.com/jobs/some-id/performance.json'
  );
  expect(uri).toContain('auth=a2600100e3d1990721be97c093f64567');
});

test('should handle errors when downloading assets', async () => {
  const response = new Error('Not Found');
  response.statusCode = 404;
  response.body = {message: 'Not Found'};
  got.get.mockReturnValueOnce(Promise.reject(response));

  const api = new SauceLabs({user: 'foo', key: 'bar'});
  const error = await api
    .downloadJobAsset('some-id', 'performance.json')
    .catch((err) => err);
  expect(error.message).toBe(
    'There was an error downloading asset performance.json: Not Found'
  );
});

test('should parse text responses if headers expect json', async () => {
  const reqRespond = {foo: 'bar'};
  got.get.mockReturnValueOnce(
    Promise.resolve({
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(reqRespond),
    })
  );
  const api = new SauceLabs({user: 'foo', key: 'bar'});
  const result = await api.downloadJobAsset('some-id', 'performance.json');
  expect(result).toEqual(reqRespond);
});

test('should fail if parameters are not given properly', async () => {
  const api = new SauceLabs({user: 'foo', key: 'bar'});
  const error = new Error(
    'You need to define a job id and the file name of the asset as a string'
  );
  await expect(api.downloadJobAsset()).rejects.toEqual(error);
  await expect(api.downloadJobAsset('foo')).rejects.toEqual(error);
  await expect(api.downloadJobAsset(123, 'bar')).rejects.toEqual(error);
});

test('should support proxy options', async () => {
  const proxy = 'http://my.proxy.com:8080';
  const api = new SauceLabs({user: 'foo', key: 'bar', proxy});
  await api.downloadJobAsset('some-id', 'performance.json');
  const requestOptions = got.extend.mock.calls[1][0];

  await expect(requestOptions.agent).toBeDefined();
});

test('should put asset into file as binary', async () => {
  const api = new SauceLabs({user: 'foo', key: 'bar'});
  await api.downloadJobAsset('some-id', 'performance.json', {
    filepath: '/asset.json',
  });
  expect(fs.writeFileSync).toBeCalledWith('/asset.json', undefined, {
    encoding: 'binary',
  });
});

test('should put asset into file as json file', async () => {
  got.setHeader({'content-type': 'application/json'});
  const api = new SauceLabs({user: 'foo', key: 'bar'});
  await api.downloadJobAsset('some-id', 'performance.json', {
    filepath: '/asset.json',
  });
  expect(fs.writeFileSync).toBeCalledWith('/asset.json', undefined, {
    encoding: 'utf8',
  });
});

test('should allow to upload files', async () => {
  fs.createReadStream.mockReturnValue({
    name: '/somefile',
    path: 'somepath',
  });

  const api = new SauceLabs({user: 'foo', key: 'bar'});
  const body = {foo: 'bar'};
  got.mockReturnValue(
    Promise.resolve({
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  );
  const result = await api.uploadJobAssets('some-id', {
    files: [
      'log.json',
      'selenium-server.json',
      {
        filename: 'raw-file.json',
        data: Buffer.from('my-raw-data', 'utf8'),
      },
      {
        filename: 'foobar.json',
        data: {foo: 'bar'},
      },
    ],
  });

  const {instances} = new FormData();
  expect(instances[0].append).toBeCalledTimes(4);
  expect(instances[0].append).toBeCalledWith(
    'file[]',
    {name: '/somefile', path: 'somepath'},
    {
      contentType: 'text/plain',
      filename: 'log.json',
      filepath: expect.any(String),
      knownLength: 123,
    }
  );
  expect(instances[0].append).toBeCalledWith(
    'file[]',
    Buffer.from('my-raw-data', 'utf8'),
    'raw-file.json'
  );
  expect(instances[0].append).toBeCalledWith(
    'file[]',
    Buffer.from(JSON.stringify({foo: 'bar'})),
    'foobar.json'
  );

  const uri = got.mock.calls[0][0];
  expect(uri).toBe(
    'https://api.us-west-1.saucelabs.com/v1/testcomposer/jobs/some-id/assets'
  );

  expect(result).toEqual(body);
});

test('should throw if custom error if upload fails', async () => {
  fs.createReadStream.mockReturnValue({
    name: '/somefile',
    path: 'somepath',
  });

  const api = new SauceLabs({user: 'foo', key: 'bar'});
  got.mockReturnValue(Promise.reject(new Error('uups')));
  const result = await api
    .uploadJobAssets('some-id', {
      files: ['log.json', '/selenium-server.json'],
    })
    .catch((err) => err);

  expect(result.message).toBe('There was an error uploading assets: uups');
});

test('should not even try to upload if no files were selected', async () => {
  const api = new SauceLabs({user: 'foo', key: 'bar'});
  const result = await api.uploadJobAssets('some-id').catch((err) => err);

  expect(result.message).toBe('No files to upload selected');
});

test('should fail if file parameter is invalid', async () => {
  const api = new SauceLabs({user: 'foo', key: 'bar'});
  const result = await api
    .uploadJobAssets('some-id', {
      files: [{foo: 'bar'}],
    })
    .catch((err) => err);

  expect(result.message).toContain('Invalid file parameter');
});

test('should contain all download links', async () => {
  const api = new SauceLabs({user: 'foo', key: 'bar'});
  got.mockReturnValue(
    Promise.resolve({
      body: {
        ...allVersions,
      },
    })
  );
  const scVersions = await api.scVersions({
    clientVersion: '5.1.1',
    clientHost: 'darwin-arm64',
    all: true,
  });
  expect(got.mock.calls).toMatchSnapshot();
  expect(scVersions.all_downloads['5.1.1'].linux).toMatchObject({
    download_url:
      'https://saucelabs.com/downloads/sauce-connect/5.1.1/sauce-connect-5.1.1_linux.x86_64.tar.gz',
    sha256: '6247e61e39ff054cf524341a681f4045c557be79bcf63c8c501e634ef2d54a41',
  });
});

test('should have status latest', async () => {
  const api = new SauceLabs({user: 'foo', key: 'bar'});
  got.mockReturnValue(
    Promise.resolve({
      body: {
        ...latestVersions,
      },
    })
  );
  const scVersions = await api.scVersions({
    clientVersion: '5.1.1',
    clientHost: 'darwin-arm64',
  });
  expect(got.mock.calls).toMatchSnapshot();
  expect(scVersions.status).toEqual('LATEST');
});

describe('startSauceConnect', () => {
  it('should start sauce connect with proper parsed args', async () => {
    const logs = [];
    const api = new SauceLabs({user: 'foo', key: 'bar'});
    setTimeout(
      () =>
        stdoutEmitter.emit(
          'data',
          'Sauce Connect is up, you may start your tests'
        ),
      50
    );
    await api.startSauceConnect({
      scVersion: '1.2.3',
      tunnelName: 'my-tunnel',
      'proxy-tunnel': 'abc',
      verbose: true,
      region: 'eu',
      logger: (log) => logs.push(log),
    });
    expect(spawn).toBeCalledTimes(1);
    expect(spawn.mock.calls).toMatchSnapshot();

    expect(logs).toHaveLength(1);
    expect(instances).toHaveLength(1);
  });

  it('should start sauce connect with latest version if no version is specified in the args', async () => {
    const logs = [];
    const api = new SauceLabs({user: 'foo', key: 'bar'});
    got.mockReturnValue(
      Promise.resolve({
        body: {
          data: {
            ...versions,
          },
        },
      })
    );
    setTimeout(
      () =>
        stdoutEmitter.emit(
          'data',
          'Sauce Connect is up, you may start your tests'
        ),
      50
    );
    await api.startSauceConnect({
      tunnelName: 'my-tunnel',
      'proxy-tunnel': 'abc',
      logger: (log) => logs.push(log),
    });
  });

  it('should start sauce connect with fallback default version in case the call to the API failed', async () => {
    const logs = [];
    const api = new SauceLabs({user: 'foo', key: 'bar'});
    got.mockImplementation(() => {
      throw new Error('Endpoint not available!');
    });
    setTimeout(
      () =>
        stdoutEmitter.emit(
          'data',
          'Sauce Connect is up, you may start your tests'
        ),
      50
    );
    await api.startSauceConnect({
      tunnelName: 'my-tunnel',
      'proxy-tunnel': 'abc',
      logger: (log) => logs.push(log),
    });
    expect(spawn.mock.calls).toMatchSnapshot();
  });

  it('should properly fail if connection could not be established', async () => {
    const errMessage = 'Sauce Connect could not establish a connection';
    const api = new SauceLabs({user: 'foo', key: 'bar'});
    setTimeout(() => stdoutEmitter.emit('data', errMessage), 50);
    const err = await api
      .startSauceConnect({
        scVersion: '1.2.3',
        tunnelName: 'my-tunnel',
        'proxy-tunnel': 'abc',
      })
      .catch((err) => err);
    expect(err.message).toBe(errMessage);
  });

  it('should properly fail if user is not authorized', async () => {
    const errMessage = 'Sauce Connect failed to start - 401 (Unauthorized).';
    const api = new SauceLabs({user: 'foo', key: 'bar'});
    setTimeout(() => stdoutEmitter.emit('data', errMessage), 50);
    const err = await api
      .startSauceConnect({
        scVersion: '1.2.3',
        tunnelName: 'my-tunnel',
        'proxy-tunnel': 'abc',
      })
      .catch((err) => err);
    expect(err.message).toContain(errMessage);
  });

  it('should close sauce connect', async () => {
    const api = new SauceLabs({user: 'foo', key: 'bar'});
    setTimeout(
      () =>
        stdoutEmitter.emit(
          'data',
          'Sauce Connect is up, you may start your tests'
        ),
      50
    );
    const sc = await api.startSauceConnect({tunnelName: 'my-tunnel'}, true);
    setTimeout(() => {
      sc.cp.stdout.emit('data', 'Some other message');
      sc.cp.stdout.emit('data', 'Goodbye');
    }, 100);
    await sc.close();
    expect(process.kill).toBeCalledWith(123, 'SIGINT');
  });

  it('should fail if stderr is emitted', async () => {
    const api = new SauceLabs({user: 'foo', key: 'bar'});
    setTimeout(() => stderrEmitter.emit('data', 'Uuups'), 50);
    const res = await api
      .startSauceConnect({tunnelName: 'my-tunnel'})
      .catch((err) => err);
    expect(res).toEqual(new Error('Uuups'));
  });

  it('should not fail if stderr is expected character', async () => {
    const api = new SauceLabs({user: 'foo', key: 'bar'});
    setTimeout(() => stderrEmitter.emit('data', '\u001b[K'), 50);
    setTimeout(
      () =>
        stdoutEmitter.emit(
          'data',
          'Sauce Connect is up, you may start your tests'
        ),
      150
    );
    const res = await api
      .startSauceConnect({tunnelName: 'my-tunnel'})
      .catch((err) => err);
    expect(res instanceof Error).toBe(false);
  });
});

test('should output failure msg for createJob API', async () => {
  const response = new Error('Response code 422 (Unprocessable Entity)');
  response.statusCode = 422;
  response.response = {body: 'empty framework'};
  got.post.mockReturnValue(Promise.reject(response));

  const api = new SauceLabs({user: 'foo', key: 'bar'});
  const error = await api.createJob({framework: ''}).catch((err) => err);

  expect(error.message).toBe(
    'Failed calling createJob: Response code 422 (Unprocessable Entity), "empty framework"'
  );
});

test('should get user by username', async () => {
  const api = new SauceLabs({user: 'foo', key: 'bar'});
  got.mockReturnValue(
    Promise.resolve({
      body: {results: [{id: 'foo-id'}]},
    })
  );
  const result = await api.getUserByUsername({username: 'fooUser'});
  expect(result).toEqual({id: 'foo-id'});
  expect(got.mock.calls[0]).toMatchSnapshot();
});

test('should get list of builds', async () => {
  const api = new SauceLabs({user: 'foo', key: 'bar'});
  got
    .mockReturnValueOnce(
      Promise.resolve({
        body: {results: [{id: 'foo-id'}]},
      })
    )
    .mockReturnValue(
      Promise.resolve({
        body: {builds: [{id: 'build-id'}]},
      })
    );
  const builds = await api.listBuilds('fooUser', {offset: 5, limit: 10});
  expect(got.mock.calls).toMatchSnapshot();
  expect(builds).toEqual([{id: 'build-id'}]);
});

test('should get builds failed jobs', async () => {
  const api = new SauceLabs({user: 'foo', key: 'bar'});
  got
    .mockReturnValueOnce(
      Promise.resolve({
        body: {results: [{id: 'foo-id'}]},
      })
    )
    .mockReturnValueOnce(
      Promise.resolve({
        body: {jobs: [{id: 'job-1'}, {id: 'job-2'}]},
      })
    )
    .mockReturnValue(
      Promise.resolve({
        body: {
          jobs: [
            {id: 'job-1', name: 'foo-job', status: 'failed'},
            {id: 'job-2', name: 'bar-job', status: 'errored'},
          ],
        },
      })
    );
  const failedJobs = await api.listBuildFailedJobs('fooUser', 'build-1', {
    offset: 5,
    limit: 10,
  });
  expect(got.mock.calls).toMatchSnapshot();
  expect(failedJobs).toMatchSnapshot();
});

test('should get builds jobs', async () => {
  const api = new SauceLabs({user: 'foo', key: 'bar'});
  got
    .mockReturnValueOnce(
      Promise.resolve({
        body: {jobs: [{id: 'job-1'}, {id: 'job-2'}]},
      })
    )
    .mockReturnValue(
      Promise.resolve({
        body: {
          jobs: [
            {id: 'job-1', name: 'foo-job', status: 'failed'},
            {id: 'job-2', name: 'bar-job', status: 'errored'},
          ],
        },
      })
    );
  const failedJobs = await api.listBuildJobs('build-1', {offset: 5, limit: 10});
  expect(got.mock.calls).toMatchSnapshot();
  expect(failedJobs).toMatchSnapshot();
});

test('should stringify searchParams', () => {
  const api = new SauceLabs({user: 'foo', key: 'bar'});
  got.mockReturnValue(
    Promise.resolve({
      body: {
        jobs: [
          {id: 'job-1', name: 'foo-job', status: 'failed'},
          {id: 'job-2', name: 'bar-job', status: 'errored'},
        ],
      },
    })
  );
  api.getJobsV1_1({id: ['job-1', 'job-2']});
  expect(got.mock.calls[0][1].searchParams).toEqual('id=job-1&id=job-2');
});

test('should get HTTPValidationError when posting test-runs failed', async () => {
  const api = new SauceLabs({user: 'foo', key: 'bar'});
  got.mockReturnValue(
    Promise.resolve({
      body: {
        detail: [
          {
            loc: ['body', 14],
            msg: 'Expecting property name enclosed in double quotes: line 1 column 15 (char 14)',
            type: 'value_error.jsondecode',
            ctx: {
              msg: 'Expecting property name enclosed in double quotes',
              doc: '...',
              pos: 14,
              lineno: 1,
              colno: 15,
            },
          },
        ],
      },
    })
  );
  const failedResp = await api.createTestRunsV1({testRuns: []});
  expect(failedResp.detail.length).toEqual(1);
  const detail = failedResp.detail[0];
  expect(detail.type).toEqual('value_error.jsondecode');
  expect(detail.msg).toEqual(
    'Expecting property name enclosed in double quotes: line 1 column 15 (char 14)'
  );
});

afterEach(() => {
  fs.writeFileSync.mockClear();
  got.mockClear();
  got.extend.mockClear();
  got.put.mockClear();
  got.get.mockClear();
  process.kill = origKill;
});
