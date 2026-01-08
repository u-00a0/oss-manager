#define MyAppName "OSS Manager"
#define MyAppVersion "0.1.1"
#define MyAppPublisher "u202f"
#define MyAppURL "https://github.com/u-00a0/oss-manager"
#define MyAppExeName "oss-manager.exe"
#define MyCliExeName "oss-cli.exe"

[Setup]
AppId={{B2C3D4E5-F6A7-4890-1234-567890ABCDEF}
AppName={#MyAppName} (Full)
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\OSS Manager
DefaultGroupName=OSS Manager
PrivilegesRequired=admin
OutputBaseFilename=oss-manager-desktop-setup-full
Compression=lzma
SolidCompression=yes
ChangesEnvironment=yes
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
LicenseFile="..\LICENSE"
WizardStyle=modern windows11

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; Desktop Binary
Source: "..\target\release\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion
; CLI Binary (Bundled)
Source: "..\target\release\{#MyCliExeName}"; DestDir: "{app}"; Flags: ignoreversion
; Webview2 Loader
Source: "..\target\release\WebView2Loader.dll"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist
; Fixed WebView2 Runtime
Source: "..\webview2-fixed\*"; DestDir: "{app}\webview2"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\OSS Manager CLI"; Filename: "{app}\{#MyCliExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[Registry]
; Add to PATH so CLI works
Root: HKLM; Subkey: "SYSTEM\CurrentControlSet\Control\Session Manager\Environment"; \
    ValueType: expandsz; ValueName: "Path"; ValueData: "{olddata};{app}"; \
    Check: NeedsAddPath(ExpandConstant('{app}'))

[Code]
function NeedsAddPath(Param: string): boolean;
var
  OrigPath: String;
begin
  if not RegQueryStringValue(HKEY_LOCAL_MACHINE,
    'SYSTEM\CurrentControlSet\Control\Session Manager\Environment',
    'Path', OrigPath)
  then begin
    Result := True;
    exit;
  end;
  Result := Pos(';' + Param + ';', ';' + OrigPath + ';') = 0;
end;
