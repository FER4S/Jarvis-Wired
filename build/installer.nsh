; ─────────────────────────────────────────────────────────────────────────────
;  build/installer.nsh — custom NSIS hooks for the Jarvis installer.
;
;  electron-builder picks this file up automatically (nsis.include defaults to
;  build/installer.nsh), so no package.json change is needed.
;
;  WHY THIS EXISTS
;  ---------------
;  A one-click update runs the OLD uninstaller before extracting the new version
;  (installSection.nsh -> uninstallOldVersion), and that ends in
;  `RMDir /r $INSTDIR`. Everything under the install folder is destroyed — which
;  used to include ~8.4 GB of installed Python packages, costing a ~4 GB
;  re-download on every single update.
;
;  From v1.1 those packages live at %LOCALAPPDATA%\Jarvis\pydeps instead. This
;  hook rescues the ones an existing v1.0 install already has, by renaming them
;  out of the doomed folder before the uninstaller runs. Both paths are on the
;  same volume, so it is an instantaneous MoveFile regardless of size — never a
;  copy (an 8 GB copy inside .onInit would look exactly like a hang).
;
;  SAFETY: this hook never deletes anything. Every failure path simply skips the
;  migration, and setup falls back to reinstalling the packages — i.e. exactly
;  the pre-v1.1 behaviour. There is no new way to lose data.
; ─────────────────────────────────────────────────────────────────────────────

!macro customInit
  ; Runs inside .onInit, AFTER initMultiUser has resolved $INSTDIR from
  ; HKCU\Software\<APP_GUID>\InstallLocation, and BEFORE Section "install"
  ; invokes the old uninstaller. preInit is too early — $INSTDIR isn't known yet.
  StrCpy $R0 "$INSTDIR\resources\backend\runtime\Lib\site-packages"
  StrCpy $R1 "$LOCALAPPDATA\Jarvis\pydeps"
  StrCpy $R2 "$LOCALAPPDATA\Jarvis\pydeps-staged"

  ; Nothing to rescue (fresh install, or already migrated).
  IfFileExists "$R0\*.*" 0 jarvis_migrate_done
  ; Already have a provisioned venv — the old copy dies with $INSTDIR, fine.
  IfFileExists "$R1\*.*" jarvis_migrate_done 0
  ; A previous attempt is already staged — don't clobber it.
  IfFileExists "$R2\*.*" jarvis_migrate_done 0

  DetailPrint "Preserving installed Python packages…"

  ; Close the app first so nothing under site-packages is held open. /T takes the
  ; whole tree, which catches the backend python spawned by the Electron main
  ; process. Best-effort: a failure here just means the rename may not succeed.
  nsExec::Exec 'taskkill /F /T /IM "${APP_EXECUTABLE_FILENAME}"'
  Pop $R3
  Sleep 1500

  CreateDirectory "$LOCALAPPDATA\Jarvis"
  ClearErrors
  Rename "$R0" "$R2"
  IfErrors 0 jarvis_migrate_ok
    DetailPrint "Could not preserve existing Python packages — setup will reinstall them."
    Goto jarvis_migrate_done
  jarvis_migrate_ok:
    DetailPrint "Existing Python packages preserved."
  jarvis_migrate_done:
!macroend

!macro customUnInstall
  ; A genuine uninstall should take the packages with it; an UPDATE must not.
  ; ${isUpdated} is set when the installer invoked us with --updated.
  ; Without this, uninstalling would silently orphan ~8.4 GB forever.
  ${IfNot} ${isUpdated}
    DetailPrint "Removing installed Python packages…"
    RMDir /r "$LOCALAPPDATA\Jarvis\pydeps"
    RMDir /r "$LOCALAPPDATA\Jarvis\pydeps-staged"
  ${EndIf}
!macroend
