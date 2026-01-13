/// <reference types="node" />
import type { CSpellSettings, DictionaryDefinition } from 'cspell';
import { readdirSync } from 'fs';
import { resolve } from 'path';

const cspellDir = resolve('./cspell');
export const dictionaries: DictionaryDefinition[] =
  readdirSync(cspellDir)
    .filter(file => file.endsWith('.txt'))
    .map(file => ({
      name: file.replace('.txt', ''),
      path: `./cspell/${file}`,
    }));

export default {
  version: '0.2',
  dictionaryDefinitions: dictionaries,
  dictionaries: ['yotta'],
  ignorePaths: ['node_modules', '/cspell/*.txt'],
} satisfies CSpellSettings;
