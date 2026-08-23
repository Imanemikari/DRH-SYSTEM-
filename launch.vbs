Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "E:\DRH"
WshShell.Run "E:\DRH\node_modules\electron\dist\electron.exe E:\DRH", 1, False
