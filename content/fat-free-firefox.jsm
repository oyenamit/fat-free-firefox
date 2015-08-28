/* ***** BEGIN LICENSE BLOCK *****
 *
 * Copyright (C) 2015 Namit Bhalla (oyenamit@gmail.com)
 * This file is part of 'Fat-Free Firefox' extension for the Firefox browser.
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


/*global NSFatFreeFirefox, Components, Services, CustomizableUI */
/*jslint this: true, white: true                                */


"use strict";


Components.utils.import( "resource:///modules/CustomizableUI.jsm" );
Components.utils.import( "resource://gre/modules/Services.jsm"    );


// ---------------------------------------------------------------------------------------------------------
// The module exports only one symbol.
// It serves as a namespace for all functions and variables.
// ---------------------------------------------------------------------------------------------------------
this.EXPORTED_SYMBOLS = [ "NSFatFreeFirefox" ];


// ---------------------------------------------------------------------------------------------------------
// The FatFreeFirefox Namespace. 
// All functions and 'global' variables reside inside it.
// Define it if it has not been done before.
// ---------------------------------------------------------------------------------------------------------
if( typeof NSFatFreeFirefox === 'undefined' )
{
    var NSFatFreeFirefox = {};
}


// ---------------------------------------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------------------------------------
NSFatFreeFirefox.PREF_FFF_TREE                  = "extensions.fat-free-firefox.";
NSFatFreeFirefox.PREF_FFF_DISABLE_POCKET        = "disable-pocket";
NSFatFreeFirefox.PREF_FFF_POCKET_AREA           = "pocket-area";
NSFatFreeFirefox.PREF_FFF_POCKET_POSITION       = "pocket-position";
NSFatFreeFirefox.PREF_BUILTIN_POCKET_ENABLED    = "browser.pocket.enabled";
NSFatFreeFirefox.PREF_BUILTIN_READER_ENABLED    = "reader.parse-on-load.enabled";
NSFatFreeFirefox.PREF_BUILTIN_HELLO_ENABLED     = "loop.enabled";
NSFatFreeFirefox.POCKET_WIDGET                  = "pocket-button";
NSFatFreeFirefox.LOG_MSG_PREFIX                 = "fat-free-firefox: ";


// ---------------------------------------------------------------------------------------------------------
// An nsIPrefBranch which is used to observe changes to preferences.
// We need to hold a reference to nsIPrefBranch because the same is needed to
// remove the observer later.
// ---------------------------------------------------------------------------------------------------------
NSFatFreeFirefox.prefBranch                     = null;


// ---------------------------------------------------------------------------------------------------------
// Object holding the 'outer' or 'calling' scope. 
// This is required because access to outer objects like ADDON_ENABLE etc is
// not directly available.
// ---------------------------------------------------------------------------------------------------------
NSFatFreeFirefox.outer                          = null;


// ---------------------------------------------------------------------------------------------------------
// Strings loaded from .properties file.
// ---------------------------------------------------------------------------------------------------------
NSFatFreeFirefox.stringBundle                   = null;


// ---------------------------------------------------------------------------------------------------------
// Standard entry point for bootstrapped extensions called by the browser.
// ---------------------------------------------------------------------------------------------------------
NSFatFreeFirefox.onInstall = function( data, reason )
{
    // Nothing needs to be done on installation.
};


// ---------------------------------------------------------------------------------------------------------
// Standard entry point for bootstrapped extensions called by the browser.
// ---------------------------------------------------------------------------------------------------------
NSFatFreeFirefox.onUninstall = function( data, reason )
{
    // Nothing needs to be done on uninstallation.
};


// ---------------------------------------------------------------------------------------------------------
// Standard entry point for bootstrapped extensions called by the browser.
// ---------------------------------------------------------------------------------------------------------
NSFatFreeFirefox.onStartup = function( data, reason, outer )
{
    this.outer = outer;

    // We must randomize the URI due to bug# 719376.
    this.stringBundle = Services.strings.createBundle( "chrome://fat-free-firefox/locale/fat-free-firefox.properties?" + Math.random() );

    if( (reason === outer.ADDON_ENABLE) || (reason === outer.ADDON_INSTALL) )
    {
        this.setDefaultPrefs();
    }

    this.prefBranch = Services.prefs.getBranch( this.PREF_FFF_TREE );
    this.prefBranch.addObserver( this.PREF_FFF_DISABLE_POCKET, this.prefObserver, false );
};


// ---------------------------------------------------------------------------------------------------------
// Standard entry point for bootstrapped extensions called by the browser.
// ---------------------------------------------------------------------------------------------------------
NSFatFreeFirefox.onShutdown = function( data, reason )
{
    if( reason !== this.outer.APP_SHUTDOWN )
    {
        this.prefBranch.removeObserver( this.PREF_FFF_DISABLE_POCKET, this.prefObserver );

        if( (reason === this.outer.ADDON_DISABLE) || (reason === this.outer.ADDON_UNINSTALL) )
        {
            this.enablePocket();
            this.enableReader();
            this.enableHello();

            this.deleteAllPrefs();

            Services.prompt.alert( null, 
                                   this.stringBundle.GetStringFromName( "fat-free-firefox.extensionName"    ), 
                                   this.stringBundle.GetStringFromName( "fat-free-firefox.onDisableRestart" ) );

            this.outer = null;
        }
    }
};



// ---------------------------------------------------------------------------------------------------------
// Disables the 'Pocket' feature of Firefox.
// ---------------------------------------------------------------------------------------------------------
NSFatFreeFirefox.disablePocket = function()
{
    // -----------------------------------------------------------------------------------------------------
    // Disabling the Pocket feature involves 2 steps:
    // 1. Set the Pocket preference to false
    // 2. Remove the Pocket widget if it has been added to any toolbar
    // -----------------------------------------------------------------------------------------------------

    var currentPocketPlacement = null;

    Services.prefs.setBoolPref( this.PREF_BUILTIN_POCKET_ENABLED, false );

    currentPocketPlacement = CustomizableUI.getPlacementOfWidget( this.POCKET_WIDGET );
    if( currentPocketPlacement !== null )
    {
        // -------------------------------------------------------------------------------------------------
        // Persist the location of the widget.
        // It would be used to restore the widget if Pocket is enabled.
        // -------------------------------------------------------------------------------------------------
        Services.prefs.setCharPref( this.PREF_FFF_TREE + this.PREF_FFF_POCKET_AREA,
                                    currentPocketPlacement.area );
        Services.prefs.setIntPref ( this.PREF_FFF_TREE + this.PREF_FFF_POCKET_POSITION,
                                    currentPocketPlacement.position );

        CustomizableUI.removeWidgetFromArea( this.POCKET_WIDGET );
    }
};


// ---------------------------------------------------------------------------------------------------------
// Enables the 'Pocket' feature of Firefox.
// ---------------------------------------------------------------------------------------------------------
NSFatFreeFirefox.enablePocket = function()
{
    // -----------------------------------------------------------------------------------------------------
    // Enabling the Pocket feature requires 2 steps:
    // 1. Set the Pocket preference to true
    // 2. Try to restore the pocket widget to its previous position
    // -----------------------------------------------------------------------------------------------------

    var lastPocketArea      = null;
    var lastPocketPosition  = null;

    Services.prefs.setBoolPref( this.PREF_BUILTIN_POCKET_ENABLED, true );

    try
    {
        lastPocketArea      = Services.prefs.getCharPref( this.PREF_FFF_TREE + this.PREF_FFF_POCKET_AREA     );
        lastPocketPosition  = Services.prefs.getIntPref ( this.PREF_FFF_TREE + this.PREF_FFF_POCKET_POSITION );
    }
    catch( err )
    {
        // Trying to get non-existent prefs throws an exception.
        // Nothing to do here.
    }

    if( (lastPocketArea !== null) && (lastPocketPosition !== null) )
    {
        // CustomizableUI.addWidgetToArea does not really throw an error but I do see
        // the following error printed in the console:
        // "[CustomizableUI]" "Widget 'pocket-button' not found, unable to move"
        // So, just as a precaution, try-catch is used.
        try
        {
            CustomizableUI.addWidgetToArea( this.POCKET_WIDGET, lastPocketArea, lastPocketPosition );
        }
        catch( err )
        {
        }

        // Delete the preferences since they are not required anymore.
        Services.prefs.clearUserPref( this.PREF_FFF_TREE + this.PREF_FFF_POCKET_AREA     );
        Services.prefs.clearUserPref( this.PREF_FFF_TREE + this.PREF_FFF_POCKET_POSITION );
    }
};


// ---------------------------------------------------------------------------------------------------------
// Enables the 'Reader' feature of Firefox.
// ---------------------------------------------------------------------------------------------------------
NSFatFreeFirefox.enableReader = function()
{
    Services.prefs.setBoolPref( this.PREF_BUILTIN_READER_ENABLED, true );
};


// ---------------------------------------------------------------------------------------------------------
// Enables the 'Hello' feature of Firefox.
// ---------------------------------------------------------------------------------------------------------
NSFatFreeFirefox.enableHello = function()
{
    Services.prefs.setBoolPref( this.PREF_BUILTIN_HELLO_ENABLED, true );
};


// ---------------------------------------------------------------------------------------------------------
// Creates and initializes preferences managed by the extension.
// ---------------------------------------------------------------------------------------------------------
NSFatFreeFirefox.setDefaultPrefs = function()
{
    Services.prefs.setBoolPref( this.PREF_FFF_TREE + this.PREF_FFF_DISABLE_POCKET, false );

    // -----------------------------------------------------------------------------------------------------
    // Do not create PREF_FFF_POCKET_AREA and PREF_FFF_POCKET_POSITION preferences. 
    // They will be created just-in-time when required.
    // -----------------------------------------------------------------------------------------------------
};


// ---------------------------------------------------------------------------------------------------------
// Deletes all preferences managed by the extension.
// ---------------------------------------------------------------------------------------------------------
NSFatFreeFirefox.deleteAllPrefs = function()
{
    Services.prefs.clearUserPref( this.PREF_FFF_TREE + this.PREF_FFF_DISABLE_POCKET  );
    Services.prefs.clearUserPref( this.PREF_FFF_TREE + this.PREF_FFF_POCKET_AREA     );
    Services.prefs.clearUserPref( this.PREF_FFF_TREE + this.PREF_FFF_POCKET_POSITION );
};


// ---------------------------------------------------------------------------------------------------------
// Observer for changes in preferences.
// ---------------------------------------------------------------------------------------------------------
NSFatFreeFirefox.prefObserver = 
{
    observe: function( subject, topic, data )
    {
        // Abbreviation for our namespace for a cleaner code.
        var nsfff    = NSFatFreeFirefox;
        var newValue = null;

        if( ("nsPref:changed" === topic) && (data === nsfff.PREF_FFF_DISABLE_POCKET) )
        {
            newValue = subject.getBoolPref( data );
            if( true === newValue )
            {
                nsfff.disablePocket();
            }
            else
            {
                nsfff.enablePocket();
            }
        }
    }
};


// ---------------------------------------------------------------------------------------------------------
// Helper logging function
// ---------------------------------------------------------------------------------------------------------
NSFatFreeFirefox.logMsg = function( message )
{
    // Use console.log method if it is available
    if( NSFatFreeFirefox.outer.console && 
        NSFatFreeFirefox.outer.console.log )
    {
        NSFatFreeFirefox.outer.console.log( this.LOG_MSG_PREFIX + message );
    }
};

