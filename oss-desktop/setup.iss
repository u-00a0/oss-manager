#define MyAppName "OSS Manager"
#define MyAppVersion "0.1.0"
#define MyAppPublisher "u202f"
#define MyAppURL "https://github.com/u-00a0/oss-manager"
#define MyAppExeName "oss-desktop.exe"
#define MyCliExeName "oss-cli.exe"

[Setup]
AppId={{A1B2C3D4-E5F6-4789-0123-456789ABCDEF}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\OSS Manager
DefaultGroupName=OSS Manager
PrivilegesRequired=admin
OutputBaseFilename=oss-manager-desktop-setup
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
Source: "..\target\release\WebView2Loader.dll"; DestDir: "{app}"; Flags: ignoreversion

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
var
  WebView2Missing: Boolean;

function IsWebView2Installed: Boolean;
var
  PV: String;
begin
  Result := RegQueryStringValue(HKEY_LOCAL_MACHINE, 'SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3C4BEC0-3506-435A-82B1-78599DCF2147}', 'pv', PV) or
            RegQueryStringValue(HKEY_CURRENT_USER, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3C4BEC0-3506-435A-82B1-78599DCF2147}', 'pv', PV);
end;

function InitializeSetup: Boolean;
begin
  Result := True;
  if not IsWebView2Installed then
  begin
    if MsgBox('This application requires the Microsoft WebView2 Runtime to run. Would you like to open the download page now?', mbConfirmation, MB_YESNO) = IDYES then
    begin
      ShellExec('open', 'https://developer.microsoft.com/en-us/microsoft-edge/webview2/#download-section', '', '', SW_SHOWNORMAL, ewNoWait, PV);
    end;
  end;
end;

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
