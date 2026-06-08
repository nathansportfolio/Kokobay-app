import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildAppVersionCheckResult } from '@/src/core/app-version/resolve-app-update-prompt';
import {
  compareVersions,
  isVersionAtLeast,
  isVersionLessThan,
} from '@/src/core/app-version/version-utils';

describe('compareVersions', () => {
  it('orders semver segments numerically', () => {
    assert.equal(compareVersions('1.0.0', '1.0.1'), -1);
    assert.equal(compareVersions('1.3.1', '1.3.0'), 1);
    assert.equal(compareVersions('2.0.0', '1.9.9'), 1);
    assert.equal(compareVersions('1.3.0', '1.3.0'), 0);
  });

  it('treats missing segments as zero', () => {
    assert.equal(compareVersions('1.3', '1.3.0'), 0);
    assert.equal(compareVersions('1', '1.0.1'), -1);
  });

  it('ignores non-numeric suffixes on segments', () => {
    assert.equal(compareVersions('1.0.0-beta', '1.0.0'), 0);
  });
});

describe('isVersionLessThan / isVersionAtLeast', () => {
  it('compares against targets', () => {
    assert.equal(isVersionLessThan('1.0.79', '1.0.80'), true);
    assert.equal(isVersionAtLeast('1.0.80', '1.0.80'), true);
    assert.equal(isVersionLessThan('1.0.80', '1.0.80'), false);
  });
});

describe('resolveAppUpdatePrompt via buildAppVersionCheckResult', () => {
  const config = {
    latestVersion: '1.3.1',
    minimumVersion: '1.3.0',
    forceUpdate: false,
    title: 'Update Available',
    message: 'Improvements',
  };

  it('requires update below minimumVersion', () => {
    const result = buildAppVersionCheckResult('1.2.9', config, false);
    assert.equal(result.prompt, 'required');
  });

  it('requires update when forceUpdate is true', () => {
    const result = buildAppVersionCheckResult('1.3.1', { ...config, forceUpdate: true }, false);
    assert.equal(result.prompt, 'required');
  });

  it('shows optional update when below latest but above minimum', () => {
    const result = buildAppVersionCheckResult('1.3.0', config, false);
    assert.equal(result.prompt, 'optional');
  });

  it('suppresses optional update after dismissal', () => {
    const result = buildAppVersionCheckResult('1.3.0', config, true);
    assert.equal(result.prompt, 'none');
    assert.equal(result.optionalDismissed, true);
  });

  it('shows no prompt when current meets latest', () => {
    const result = buildAppVersionCheckResult('1.3.1', config, false);
    assert.equal(result.prompt, 'none');
  });

  it('fail-open when config is missing', () => {
    const result = buildAppVersionCheckResult('1.0.0', null, false);
    assert.equal(result.prompt, 'none');
    assert.equal(result.config, null);
  });
});
