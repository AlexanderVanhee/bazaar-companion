/* removeDialog.js
 *
 * Copyright (C) 2025 Alexander Vanhee
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';

async function getInstalledRefs(appId) {
    const refs = [];
    for (const scope of ['--user', '--system']) {
        try {
            const proc = new Gio.Subprocess({
                argv: ['flatpak', 'info', scope, appId],
                flags: Gio.SubprocessFlags.STDOUT_SILENCE | Gio.SubprocessFlags.STDERR_SILENCE,
            });
            proc.init(null);
            await new Promise((resolve) => proc.wait_async(null, (_, result) => {
                proc.wait_finish(result);
                resolve();
            }));
            if (proc.get_exit_status() === 0)
                refs.push(scope);
        } catch (e) { }
    }
    return refs;
}

async function uninstallRef(appId, scope, deleteData) {
    const args = ['flatpak', 'uninstall', scope, '-y', appId];
    if (deleteData)
        args.push('--delete-data');
    const proc = new Gio.Subprocess({
        argv: args,
        flags: Gio.SubprocessFlags.NONE,
    });
    proc.init(null);
    return new Promise((resolve) => {
        proc.wait_async(null, (_, result) => {
            proc.wait_finish(result);
            resolve(proc.get_exit_status() === 0);
        });
    });
}

function showNotification(title, body, isError = false) {
    const source = new MessageTray.Source({
        title: 'Bazaar',
        icon: new Gio.ThemedIcon({ name: 'io.github.kolunmi.Bazaar' }),
    });
    Main.messageTray.add(source);

    const notification = new MessageTray.Notification({
        source,
        title,
        body,
        isTransient: true,
    });

    source.addNotification(notification);
}

function _findAppIcon(appId) {
    const appDisplay = Main.overview._overview._controls._appDisplay;

    for (const child of appDisplay._orderedItems) {
        if (child._id === `${appId}.desktop` || child._id === appId)
            return child;
    }

    for (const child of appDisplay._orderedItems) {
        if (child._folder) {
            for (const folderChild of child.view._orderedItems) {
                if (folderChild._id === `${appId}.desktop` || folderChild._id === appId)
                    return folderChild;
            }
        }
    }

    return null;
}

function makeRadioRow(title, subtitle, radioGroup, isActive) {
    const row = new St.Button({
        style_class: 'bazaar-remove-dialog-radio-row',
        x_expand: true,
    });

    const inner = new St.BoxLayout({
        vertical: false,
        x_expand: true,
    });

    const textBox = new St.BoxLayout({
        vertical: true,
        x_expand: true,
        style_class: 'bazaar-remove-dialog-radio-text',
    });

    const titleLabel = new St.Label({
        text: title,
        style_class: 'bazaar-remove-dialog-radio-title',
    });

    const subtitleLabel = new St.Label({
        text: subtitle,
        style_class: 'bazaar-remove-dialog-radio-subtitle',
    });
    subtitleLabel.clutter_text.line_wrap = true;

    textBox.add_child(titleLabel);
    textBox.add_child(subtitleLabel);

    const radio = new St.Button({
        style_class: 'bazaar-remove-dialog-radio-button',
        toggle_mode: true,
        checked: isActive,
        y_align: Clutter.ActorAlign.CENTER,
        reactive: false,
        can_focus: false,
    });

    radioGroup.push(radio);

    inner.add_child(radio);
    inner.add_child(textBox);
    row.set_child(inner);

    row.connect('clicked', () => {
        radio.checked = true;
        for (const other of radioGroup) {
            if (other !== radio)
                other.checked = false;
        }
    });

    return { row, radio };
}

function showSimpleDialog(title, subtitle, buttonLabel, onConfirm) {
    const dialog = new ModalDialog.ModalDialog({
        styleClass: 'bazaar-remove-dialog',
    });

    const label = new St.Label({
        text: title,
        style_class: 'bazaar-remove-dialog-title',
    });
    dialog.contentLayout.add_child(label);

    const sublabel = new St.Label({
        text: subtitle,
        style_class: 'bazaar-remove-dialog-subtitle',
    });
    sublabel.clutter_text.line_wrap = true;
    sublabel.clutter_text.ellipsize = false;
    dialog.contentLayout.add_child(sublabel);

    let keepDataRadio = null;

    if (onConfirm) {
        const radioGroup = [];

        const list = new St.BoxLayout({
            vertical: true,
            style_class: 'bazaar-remove-dialog-list',
        });

        const { row: keepRow, radio: keepRadio } = makeRadioRow(
            'Keep Data',
            'Allow restoring settings and content',
            radioGroup,
            true
        );
        keepDataRadio = keepRadio;

        const { row: deleteRow } = makeRadioRow(
            'Delete Data',
            'Permanently remove app data to save space',
            radioGroup,
            false
        );

        const separator = new St.Widget({
            style: 'height: 1px; background-color: #2d2d31;',
            x_expand: true,
        });
        list.add_child(keepRow);
        list.add_child(separator);
        list.add_child(deleteRow);

        dialog.contentLayout.add_child(list);

        dialog.setButtons([
            {
                label: 'Cancel',
                action: () => dialog.close(),
                key: Clutter.KEY_Escape,
            },
        ]);

        const button = dialog.addButton({
            label: buttonLabel,
            action: () => {
                dialog.close();
                onConfirm(!keepDataRadio.checked);
            },
        });
        button.add_style_class_name('bazaar-remove-dialog-destructive');
    } else {
        dialog.setButtons([
            {
                label: buttonLabel,
                action: () => dialog.close(),
                key: Clutter.KEY_Escape,
            },
        ]);
    }

    dialog.open();
}

export async function showRemoveDialog(app) {
    if (!app) return;

    const appName = app.get_name() ?? 'this app';
    const appId = app.get_id()?.replace(/\.desktop$/, '');
    if (!appId) return;

    const installedRefs = await getInstalledRefs(appId);

    if (installedRefs.length === 0) {
        showNotification('Cannot Uninstall App', `${appName} does not appear to be installed as a Flatpak.`, true);
        return;
    }

    if (installedRefs.length > 1) {
        showSimpleDialog(
            `Remove ${appName}?`,
            `${appName} is installed in multiple locations. Please use Bazaar to manage it.`,
            'OK',
            null
        );
        return;
    }

    showSimpleDialog(
        `Remove ${appName}?`,
        `It will not be possible to use ${appName} after it is uninstalled.`,
        'Uninstall',
        async (deleteData) => {
            const scope = installedRefs[0];

            const appIcon = _findAppIcon(appId);
            if (appIcon)
                appIcon.hide();

            console.log(`Bazaar Integration: Uninstalling ${appId} ${scope} deleteData=${deleteData}`);
            const success = await uninstallRef(appId, scope, deleteData);
            console.log(`Bazaar Integration: Uninstall ${scope} ${success ? 'succeeded' : 'failed'} for ${appId}`);

            if (success) {
                showNotification(`${appName} Uninstalled`, `${appName} was successfully removed.`);
            } else {
                if (appIcon)
                    appIcon.show();
                showNotification(`Failed to Remove ${appName}`, `Could not uninstall ${appName}. Try using Bazaar instead.`, true);
            }
        }
    );
}
