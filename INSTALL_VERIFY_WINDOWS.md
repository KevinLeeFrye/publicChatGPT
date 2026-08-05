# Windows install and verification

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\INSTALL_VERIFY_WINDOWS.ps1 -CreateDesktopShortcut -OpenBrowser -KeepDashboardRunning
```

Manual:

```powershell
.\setup.ps1
.\frye.ps1 selfcheck
.\frye.ps1 test --all
.\frye.ps1 status
.\frye.ps1 serve --open-browser
```
