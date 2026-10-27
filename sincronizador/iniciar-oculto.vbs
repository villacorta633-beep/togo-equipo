' Arranca el sincronizador sin abrir ventana. Lo usa la tarea programada de Windows.
Set fso = CreateObject("Scripting.FileSystemObject")
carpeta = fso.GetParentFolderName(WScript.ScriptFullName)
Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = carpeta
shell.Run "node """ & carpeta & "\sincronizador.js""", 0, False
