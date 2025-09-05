module.exports = {
  plugins: [
    require('autoprefixer'),
    {
      // Suprimir warnings de selectores CSS inválidos
      postcssPlugin: 'suppress-css-warnings',
      Once(root, { result }) {
        // Esta configuración ayuda a suprimir warnings de selectores CSS
        // que pueden causar problemas con Angular CLI
      }
    }
  ]
};
