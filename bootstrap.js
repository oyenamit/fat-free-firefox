/* ***** BEGIN LICENSE BLOCK *****
 *
 * Copyright (C) 2015 Namit Bhalla (oyenamit@gmail.com)
 * This file is part of 'Fat-Free Fox' extension for the Firefox browser.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 * ***** END LICENSE BLOCK ***** */


/*global Components, NSFatFreeFirefox */
/*jslint this: true, white: true      */


"use strict";


var reasons  = ["", "APP_STARTUP", "APP_SHUTDOWN", "ADDON_ENABLE", "ADDON_DISABLE", "ADDON_INSTALL", "ADDON_UNINSTALL", "ADDON_UPGRADE", "ADDON_DOWNGRADE"];


var this_scope = {
                    ADDON_ENABLE:     ADDON_ENABLE, 
                    ADDON_INSTALL:    ADDON_INSTALL, 
                    ADDON_UPGRADE:    ADDON_UPGRADE, 
                    ADDON_DOWNGRADE:  ADDON_DOWNGRADE, 
                    ADDON_DISABLE:    ADDON_DISABLE, 
                    ADDON_UNINSTALL:  ADDON_UNINSTALL, 
                    APP_SHUTDOWN:     APP_SHUTDOWN, 
                    console:          console 
                };


// -----------------------------------------------------------------------------
// Standard entry point for bootstrapped extensions called by the browser.
// -----------------------------------------------------------------------------
function install( data, reason )
{
    // Nothing needs to be done on installation.

    // -------------------------------------------------------------------------
    // NSFatFreeFirefox is not available here so we cannot call
    // NSFatFreeFirefox.onInstall().
    // The jsm can be imported only in startup()
    // -------------------------------------------------------------------------
}


// -----------------------------------------------------------------------------
// Standard entry point for bootstrapped extensions called by the browser.
// -----------------------------------------------------------------------------
function startup( data, reason )
{
    // This is the earliest where NSFatFreeFirefox is available.
    Components.utils.import( "chrome://fat-free-firefox/content/fat-free-firefox.jsm" );

    NSFatFreeFirefox.onStartup( data, reason, this_scope );
}


// -----------------------------------------------------------------------------
// Standard entry point for bootstrapped extensions called by the browser.
// -----------------------------------------------------------------------------
function shutdown( data, reason )
{
    NSFatFreeFirefox.onShutdown( data, reason );

    // NSFatFreeFirefox will no longer be available.
    Components.utils.unload( "chrome://fat-free-firefox/content/fat-free-firefox.jsm" );
}


// -----------------------------------------------------------------------------
// Standard entry point for bootstrapped extensions called by the browser.
// -----------------------------------------------------------------------------
function uninstall( data, reason )
{
    // Nothing needs to be done on uninstallation.

    // -------------------------------------------------------------------------
    // NSFatFreeFirefox will not be available here since we are unloading the 
    // jsm in shutdown()
    // -------------------------------------------------------------------------
}

