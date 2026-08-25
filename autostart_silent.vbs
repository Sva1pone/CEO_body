Option Explicit

Dim shell, fso, projectDir, pythonw, application
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

projectDir = fso.GetParentFolderName(WScript.ScriptFullName)
pythonw = fso.BuildPath(projectDir, ".venv\Scripts\pythonw.exe")
application = fso.BuildPath(projectDir, "app.py")

shell.CurrentDirectory = projectDir
shell.Run Chr(34) & pythonw & Chr(34) & " " & Chr(34) & application & Chr(34) & " --headless", 0, False
