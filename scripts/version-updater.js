#!/usr/bin/env node

/**
 * Script para actualizar automáticamente la versión del programa Cerbero
 * Uso: node scripts/version-updater.js [major|minor|patch|build|dev]
 */

const fs = require('fs');
const path = require('path');

// Ruta al archivo de versión
const versionFile = path.join(__dirname, '../src/app/version.ts');

// Función para leer el archivo de versión actual
function readCurrentVersion() {
  try {
    const content = fs.readFileSync(versionFile, 'utf8');
    const versionMatch = content.match(/version:\s*['"`]([^'"`]+)['"`]/);
    const buildMatch = content.match(/buildNumber:\s*['"`]([^'"`]+)['"`]/);
    
    if (versionMatch && buildMatch) {
      return {
        version: versionMatch[1],
        buildNumber: buildMatch[1]
      };
    }
    throw new Error('No se pudo leer la versión actual');
  } catch (error) {
    console.error('Error al leer la versión actual:', error.message);
    process.exit(1);
  }
}

// Función para incrementar la versión
function incrementVersion(currentVersion, type) {
  // Extraer la versión base (sin sufijos como -beta, -alpha, etc.)
  const baseVersion = currentVersion.split('-')[0];
  const [major, minor, patch] = baseVersion.split('.').map(Number);
  
  switch (type) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    case 'dev':
      // Para desarrollo, mantener la versión pero cambiar sufijo
      return `${major}.${minor}.${patch}-dev`;
    default:
      throw new Error('Tipo de incremento inválido. Use: major, minor, patch, dev o build');
  }
}

// Función para generar el número de build
function generateBuildNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  
  // Leer el contador actual del archivo de versión
  const currentBuild = readCurrentVersion();
  let buildCounter = 1;
  
  // Extraer el contador del build actual si existe
  if (currentBuild.buildNumber) {
    const parts = currentBuild.buildNumber.split('.');
    if (parts.length === 3) {
      const currentMonth = parts[1];
      const currentCounter = parseInt(parts[2]);
      
      // Si es el mismo mes, incrementar el contador
      if (currentMonth === month) {
        buildCounter = currentCounter + 1;
      }
      // Si es un mes nuevo, reiniciar contador
    }
  }
  
  return `${year}.${month}.${String(buildCounter).padStart(3, '0')}`;
}

// Función para actualizar el archivo de versión
function updateVersionFile(newVersion, newBuildNumber) {
  try {
    let content = fs.readFileSync(versionFile, 'utf8');
    
    // Actualizar versión
    content = content.replace(
      /version:\s*['"`][^'"`]+['"`]/,
      `version: '${newVersion}'`
    );
    
    // Actualizar número de build
    content = content.replace(
      /buildNumber:\s*['"`][^'"`]+['"`]/,
      `buildNumber: '${newBuildNumber}'`
    );
    
    // Actualizar fecha de release
    const releaseDate = new Date().toISOString().split('T')[0];
    content = content.replace(
      /releaseDate:\s*['"`][^'"`]+['"`]/,
      `releaseDate: '${releaseDate}'`
    );
    
    fs.writeFileSync(versionFile, content, 'utf8');
    console.log(`✅ Versión actualizada exitosamente:`);
    console.log(`   Versión: ${newVersion}`);
    console.log(`   Build: ${newBuildNumber}`);
    console.log(`   Fecha: ${releaseDate}`);
    
  } catch (error) {
    console.error('Error al actualizar el archivo de versión:', error.message);
    process.exit(1);
  }
}

// Función principal
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('🔧 Script de Actualización de Versión - Cerbero');
    console.log('');
    console.log('Uso: node scripts/version-updater.js [tipo]');
    console.log('');
    console.log('Tipos de incremento:');
    console.log('  major    - Incrementa la versión mayor (0.9.0 → 1.0.0)');
    console.log('  minor    - Incrementa la versión menor (0.9.0 → 0.10.0)');
    console.log('  patch    - Incrementa la versión de parche (0.9.0 → 0.9.1)');
    console.log('  dev      - Marca como versión de desarrollo (0.9.0 → 0.9.0-dev)');
    console.log('  build    - Solo actualiza el número de build y fecha');
    console.log('');
    console.log('📅 CUÁNDO ACTUALIZAR BUILD:');
    console.log('  • Después de cada deploy a testing/producción');
    console.log('  • Al finalizar sprints de desarrollo');
    console.log('  • Para marcar hitos importantes del proyecto');
    console.log('  • Después de correcciones de bugs críticos');
    console.log('');
    console.log('Ejemplos:');
    console.log('  node scripts/version-updater.js minor');
    console.log('  node scripts/version-updater.js build');
    console.log('  node scripts/version-updater.js dev');
    return;
  }
  
  const type = args[0];
  const current = readCurrentVersion();
  
  console.log(`📋 Versión actual: ${current.version} (${current.buildNumber})`);
  
  let newVersion = current.version;
  if (type !== 'build') {
    newVersion = incrementVersion(current.version, type);
  }
  
  const newBuildNumber = generateBuildNumber();
  
  updateVersionFile(newVersion, newBuildNumber);
}

// Ejecutar el script
if (require.main === module) {
  main();
}

module.exports = {
  readCurrentVersion,
  incrementVersion,
  generateBuildNumber,
  updateVersionFile
}; 