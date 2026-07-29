/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerThemingParticipant } from '../../platform/theme/common/themeService.js';
import { editorBackground } from '../../platform/theme/common/colorRegistry.js';
import { ColorIdentifier } from '../../platform/theme/common/colorUtils.js';
import { ACTIVITY_BAR_BACKGROUND, EDITOR_GROUP_HEADER_TABS_BACKGROUND, PANEL_BACKGROUND, SIDE_BAR_BACKGROUND, STATUS_BAR_BACKGROUND, TITLE_BAR_ACTIVE_BACKGROUND } from '../common/theme.js';

/**
 * Marks a workbench that lives in a window with a system-drawn backdrop
 * (`window.vibrancy`). Only the flat surfaces that make up the window
 * background become translucent; everything drawn on top of them keeps its
 * theme color so that text and controls stay legible.
 */
export const VIBRANCY_CLASS_NAME = 'vibrancy';

/**
 * How much of a surface's own theme color survives. The remainder is what the
 * system backdrop shows through.
 */
const SURFACE_ALPHA = 0.6;

registerThemingParticipant((theme, collector) => {
	const root = `.monaco-workbench.${VIBRANCY_CLASS_NAME}`;

	// The workbench root itself is fully transparent. The parts below each paint
	// their own translucent surface over it, and stacking two translucent layers
	// would make the window noticeably more opaque than intended.
	collector.addRule(`${root} { background-color: transparent; }`);

	// Parts assign their background as an inline style (see the `updateStyles`
	// of each part), so these rules have to be `!important` to take effect.
	const addSurfaceRule = (selector: string, colorId: ColorIdentifier) => {
		const color = theme.getColor(colorId);
		if (color) {
			collector.addRule(`${selector} { background-color: ${color.transparent(SURFACE_ALPHA)} !important; }`);
		}
	};

	addSurfaceRule(`${root} .part.titlebar`, TITLE_BAR_ACTIVE_BACKGROUND);
	addSurfaceRule(`${root} .part.activitybar`, ACTIVITY_BAR_BACKGROUND);
	addSurfaceRule(`${root} .part.sidebar, ${root} .part.auxiliarybar`, SIDE_BAR_BACKGROUND);
	addSurfaceRule(`${root} .part.panel`, PANEL_BACKGROUND);
	addSurfaceRule(`${root} .part.statusbar`, STATUS_BAR_BACKGROUND);
	addSurfaceRule(`${root} .editor-group-container > .title`, EDITOR_GROUP_HEADER_TABS_BACKGROUND);
	addSurfaceRule(`${root} .editor-group-container > .editor-container`, editorBackground);

	// The editor paints `editor.background` again on top of its container, which
	// would put an opaque layer straight back over the translucent one.
	collector.addRule(`
		${root} .editor-group-container > .editor-container .monaco-editor,
		${root} .editor-group-container > .editor-container .monaco-editor-background {
			background-color: transparent;
		}
	`);
});
