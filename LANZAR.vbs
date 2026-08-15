Dim oShell
Set oShell = WScript.CreateObject("WScript.Shell")
Dim ruta
ruta = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\") - 1)
oShell.CurrentDirectory = ruta
oShell.Run "cmd.exe /K npm run dev", 1, False
