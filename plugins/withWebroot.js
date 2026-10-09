// webroot/ papkasini (tayyor frontend) native ilova ichiga joylaydi:
//   Android: android/app/src/main/assets/webroot
//   iOS:     <ilova bundle>/webroot  (Xcode'ga folder reference sifatida)
const fs = require('fs');
const path = require('path');
const { withDangerousMod, withXcodeProject, IOSConfig } = require('expo/config-plugins');

const DIR = 'webroot';

const copyWebroot = (projectRoot, target) => {
  const source = path.join(projectRoot, DIR);
  if (!fs.existsSync(path.join(source, 'index.html'))) {
    throw new Error(`${DIR}/index.html topilmadi. Avval frontendni tayyorlang: npm run prepare-web`);
  }
  fs.rmSync(target, { recursive: true, force: true });
  fs.cpSync(source, target, { recursive: true });
};

const withAndroidWebroot = (config) =>
  withDangerousMod(config, [
    'android',
    (cfg) => {
      const { projectRoot, platformProjectRoot } = cfg.modRequest;
      copyWebroot(projectRoot, path.join(platformProjectRoot, 'app/src/main/assets', DIR));
      return cfg;
    },
  ]);

const withIosWebroot = (config) => {
  config = withDangerousMod(config, [
    'ios',
    (cfg) => {
      const { projectRoot, platformProjectRoot, projectName } = cfg.modRequest;
      copyWebroot(projectRoot, path.join(platformProjectRoot, projectName, DIR));
      return cfg;
    },
  ]);

  return withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const { projectName } = cfg.modRequest;
    const filepath = `${projectName}/${DIR}`;

    IOSConfig.XcodeUtils.addResourceFileToGroup({
      filepath,
      groupName: projectName,
      isBuildFile: true,
      project,
    });

    // Papka "folder reference" bo'lishi kerak — shunda ichki tuzilma saqlanadi
    const refs = project.pbxFileReferenceSection();
    for (const key of Object.keys(refs)) {
      const ref = refs[key];
      if (typeof ref === 'object' && [DIR, `"${DIR}"`].includes(ref.name ?? ref.path)) {
        ref.lastKnownFileType = 'folder';
      }
    }
    return cfg;
  });
};

module.exports = (config) => withIosWebroot(withAndroidWebroot(config));
