import test from 'node:test';
import assert from 'node:assert/strict';
import { appearanceThemes, normalizeAppearanceTheme, resolveAppearanceTheme } from '../src/appearance.js';

test('appearance offers system, light and dark choices in the requested order', () => {
  assert.deepEqual(appearanceThemes, ['system', 'light', 'dark']);
});

test('new or invalid theme preferences follow the operating system', () => {
  assert.equal(normalizeAppearanceTheme(undefined), 'system');
  assert.equal(normalizeAppearanceTheme('invalid'), 'system');
  assert.equal(normalizeAppearanceTheme('dark'), 'dark');
});

test('system theme follows appearance changes while explicit choices remain fixed', () => {
  assert.equal(resolveAppearanceTheme('system', true), 'dark');
  assert.equal(resolveAppearanceTheme('system', false), 'light');
  assert.equal(resolveAppearanceTheme('light', true), 'light');
  assert.equal(resolveAppearanceTheme('dark', false), 'dark');
});
