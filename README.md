# bazaar-companion
 
GNOME extension that better integrates [Bazaar](https://github.com/kolunmi/bazaar) into GNOME Shell. Currently adds back the "App Details" menu item and makes it open Flatpak apps in Bazaar instead of GNOME Software.
The extension should work with any reasonably recent version of Bazaar.

It also adds a "Uninstall" button for Flatpak apps.

<img width="392" height="220" alt="image" src="https://github.com/user-attachments/assets/d842902f-043a-4d9a-9dd0-312126865501" />


## Installing

Use the following command in the root directory of the cloned repo to build and install:
```bash
./build.sh -i
```

the extension bundle should be called `bazaar-integration@kolunmi.github.io.shell-extension.zip`.
