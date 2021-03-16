// rollup.config.js
import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/index.ts',
  output: {
    file: 'dist/koilogs.js',
    format: 'cjs'
  },
  plugins: [ typescript() ]
};