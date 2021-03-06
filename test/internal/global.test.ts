/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as assert from 'assert';
import { getGlobal } from '../../src/internal/global-utils';
import { _globalThis } from '../../src/platform';
import { NoopContextManager } from '../../src/context/NoopContextManager';
import sinon = require('sinon');

const api1 = require('../../src') as typeof import('../../src');

// clear cache and load a second instance of the api
for (const key of Object.keys(require.cache)) {
  delete require.cache[key];
}
const api2 = require('../../src') as typeof import('../../src');

describe('Global Utils', () => {
  // prove they are separate instances
  assert.notEqual(api1, api2);
  // that return separate noop instances to start
  assert.notStrictEqual(
    api1.context['_getContextManager'](),
    api2.context['_getContextManager']()
  );

  beforeEach(() => {
    api1.context.disable();
    api1.propagation.disable();
    api1.trace.disable();
    api1.diag.disable();
    // @ts-expect-error we are modifying internals for testing purposes here
    delete _globalThis[Symbol.for('io.opentelemetry.js.api.0')];
  });

  it('should change the global context manager', () => {
    const original = api1.context['_getContextManager']();
    const newContextManager = new NoopContextManager();
    api1.context.setGlobalContextManager(newContextManager);
    assert.notStrictEqual(api1.context['_getContextManager'](), original);
    assert.strictEqual(api1.context['_getContextManager'](), newContextManager);
  });

  it('should load an instance from one which was set in the other', () => {
    api1.context.setGlobalContextManager(new NoopContextManager());
    assert.strictEqual(
      api1.context['_getContextManager'](),
      api2.context['_getContextManager']()
    );
  });

  it('should disable both if one is disabled', () => {
    const original = api1.context['_getContextManager']();

    api1.context.setGlobalContextManager(new NoopContextManager());

    assert.notStrictEqual(original, api1.context['_getContextManager']());
    api2.context.disable();
    assert.strictEqual(original, api1.context['_getContextManager']());
  });

  it('should return the module NoOp implementation if the version is a mismatch', () => {
    const original = api1.context['_getContextManager']();
    const newContextManager = new NoopContextManager();
    api1.context.setGlobalContextManager(newContextManager);

    assert.strictEqual(api1.context['_getContextManager'](), newContextManager);

    const globalInstance = getGlobal('context');
    assert.ok(globalInstance);
    // @ts-expect-error we are modifying internals for testing purposes here
    _globalThis[Symbol.for('io.opentelemetry.js.api.0')].version = '0.0.1';

    assert.strictEqual(api1.context['_getContextManager'](), original);
  });

  it('should log an error if there is a duplicate registration', () => {
    const error = sinon.stub();
    api1.diag.setLogger({
      verbose: () => {},
      debug: () => {},
      info: () => {},
      warn: () => {},
      error,
    });

    api1.context.setGlobalContextManager(new NoopContextManager());
    api1.context.setGlobalContextManager(new NoopContextManager());

    sinon.assert.calledOnce(error);
    assert.strictEqual(error.firstCall.args.length, 1);
    assert.ok(
      error.firstCall.args[0].startsWith(
        'Error: @opentelemetry/api: Attempted duplicate registration of API: context'
      )
    );
  });

  it('should allow duplicate registration of the diag logger', () => {
    const error1 = sinon.stub();
    const error2 = sinon.stub();
    api1.diag.setLogger({
      verbose: () => {},
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: error1,
    });

    api1.diag.setLogger({
      verbose: () => {},
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: error2,
    });

    sinon.assert.notCalled(error1);
    sinon.assert.notCalled(error2);
  });
});
