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


/*global Components, Services, CustomizableUI */
/*jslint this: true, white: true              */


"use strict";


Components.utils.import( "resource:///modules/CustomizableUI.jsm" );
Components.utils.import( "resource://gre/modules/Services.jsm"    );


// ---------------------------------------------------------------------------------------------------------
// The module exports only one symbol.
// It serves as a namespace for all public functions and variables.
// ---------------------------------------------------------------------------------------------------------
this.EXPORTED_SYMBOLS = [ "FatFreeFirefox" ];


// ---------------------------------------------------------------------------------------------------------
// The FatFreeFirefox namespace. 
// All public, exported functions and variables reside inside it.
// ---------------------------------------------------------------------------------------------------------
var FatFreeFirefox = {};


// ---------------------------------------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------------------------------------
const PREF_FFF_TREE                              = "extensions.fat-free-firefox.";
const PREF_FFF_DISABLE_POCKET                    = "disable-pocket";
const PREF_FFF_POCKET_AREA                       = "pocket-area";
const PREF_FFF_POCKET_POSITION                   = "pocket-position";
const PREF_FFF_DISABLE_SPEC_CONN                 = "disable-speculative-connections";
const PREF_BUILTIN_POCKET_ENABLED                = "browser.pocket.enabled";
const PREF_BUILTIN_POCKET_ENABLED_SYS_ADDON      = "extensions.pocket.enabled";
const PREF_BUILTIN_READER_ENABLED                = "reader.parse-on-load.enabled";
const PREF_BUILTIN_HELLO_ENABLED                 = "loop.enabled";
const PREF_BUILTIN_SPEC_CONN                     = "network.http.speculative-parallel-limit";
const PREF_BUILTIN_DNS_PREFETCH                  = "network.dns.disablePrefetch";
const PREF_BUILTIN_LINK_PREFETCH                 = "network.prefetch-next";
const PREF_BUILTIN_PUSH_NOTIFICATIONS            = "dom.push.enabled";
const PREF_BUILTIN_WEB_RTC_LEAK                  = "media.peerconnection.ice.default_address_only";
const PREF_BUILTIN_TRACKING_PROTECTION           = "privacy.trackingprotection.enabled";
const PREF_BUILTIN_BEACON                        = "beacon.enabled";
const PREF_BUILTIN_UNIFIED_COMPL                 = "browser.urlbar.unifiedcomplete";
const POCKET_WIDGET                              = "pocket-button";
const POCKET_SYS_ADDON_VER                       = "46.0a1";
const SPEC_CONN_OFF_VAL                          = 0;
const LOG_MSG_PREFIX                             = "fat-free-firefox 2.2: ";


// ---------------------------------------------------------------------------------------------------------
// An nsIPrefBranch which is used to observe changes to preferences.
// We need to hold a reference to nsIPrefBranch because the same is needed to
// remove the observer later.
// ---------------------------------------------------------------------------------------------------------
var prefBranch      = null;


// ---------------------------------------------------------------------------------------------------------
// Object holding the 'outer' or 'calling' scope. 
// This is required because access to outer objects like ADDON_ENABLE etc is
// not directly available.
// ---------------------------------------------------------------------------------------------------------
var outer           = null;


// ---------------------------------------------------------------------------------------------------------
// Strings loaded from .properties file.
// ---------------------------------------------------------------------------------------------------------
var stringBundle    = null;


// ---------------------------------------------------------------------------------------------------------
// Standard entry point for bootstrapped extensions called by the browser.
// ---------------------------------------------------------------------------------------------------------
FatFreeFirefox.onInstall = function( data, reason )
{
    // Nothing needs to be done on installation.
};


// ---------------------------------------------------------------------------------------------------------
// Standard entry point for bootstrapped extensions called by the browser.
// ---------------------------------------------------------------------------------------------------------
FatFreeFirefox.onUninstall = function( data, reason )
{
    // Nothing needs to be done on uninstallation.
};


// ---------------------------------------------------------------------------------------------------------
// Standard entry point for bootstrapped extensions called by the browser.
// ---------------------------------------------------------------------------------------------------------
FatFreeFirefox.onStartup = function( data, reason, outer_scope )
{
    outer = outer_scope;

    // We must randomize the URI due to bug# 719376.
    stringBundle = Services.strings.createBundle( "chrome://fat-free-firefox/locale/fat-free-firefox.properties?" + Math.random() );

    if( (reason === outer.ADDON_ENABLE )  || (reason === outer.ADDON_INSTALL    ) ||
        (reason === outer.ADDON_UPGRADE)  || (reason === outer.ADDON_DOWNGRADE) )
    {
        setDefaultPrefs();
    }


    if( reason === outer.ADDON_INSTALL )
    {
        // -------------------------------------------------------------------------------------------------
        // When a fresh install or upgrade happens, display the documentation page to the user.
        // Don't show it when downgrade happens.
        //
        // Since the current version is a minor update, do not show it when upgrade happens.
        // -------------------------------------------------------------------------------------------------
        var aDOMWindow                  = Services.wm.getMostRecentWindow( 'navigator:browser' );
        aDOMWindow.gBrowser.selectedTab = aDOMWindow.gBrowser.addTab( "chrome://fat-free-firefox/locale/doc.html", {relatedToCurrent: true} );
    }

    prefBranch = Services.prefs.getBranch( PREF_FFF_TREE );
    prefBranch.addObserver( PREF_FFF_DISABLE_POCKET,    prefObserver, false );
    prefBranch.addObserver( PREF_FFF_DISABLE_SPEC_CONN, prefObserver, false );
};


// ---------------------------------------------------------------------------------------------------------
// Standard entry point for bootstrapped extensions called by the browser.
// ---------------------------------------------------------------------------------------------------------
FatFreeFirefox.onShutdown = function( data, reason )
{
    if( reason !== outer.APP_SHUTDOWN )
    {
        prefBranch.removeObserver( PREF_FFF_DISABLE_POCKET,    prefObserver );
        prefBranch.removeObserver( PREF_FFF_DISABLE_SPEC_CONN, prefObserver );

        if( (reason === outer.ADDON_DISABLE) || (reason === outer.ADDON_UNINSTALL) )
        {
            // ---------------------------------------------------------------------------------------------
            // Extension is about to be disabled/uninstalled.
            // Revert all supported features to their default values.
            // ---------------------------------------------------------------------------------------------
            enablePocket();
            enableReader();
            enableHello();
            enableSpecConn();
            enableDNSPrefetch();
            enableLinkPrefetch();
            enablePushNotifications();
            enableWebRTCLeak();
            disableTrackingProtection();
            enableBeacon();
            enableUnifiedCompl();

            deleteAllPrefs();

            Services.prompt.alert( null, 
                                   stringBundle.GetStringFromName( "fat-free-firefox.extensionName"    ), 
                                   stringBundle.GetStringFromName( "fat-free-firefox.onDisableRestart" ) );
        }

        if( reason === outer.ADDON_DOWNGRADE )
        {
            // ---------------------------------------------------------------------------------------------
            // User is downgrading to an older version. We need to remove the preferences added in the
            // current version and also enable the corresponding features.
            // ---------------------------------------------------------------------------------------------
            if( data.newVersion < 1.0 )
            {
                // -----------------------------------------------------------------------------------------
                // Support for Speculative Connections was added in v1.0
                // If we are being downgraded to a version below that, we need to enable it again.
                // -----------------------------------------------------------------------------------------
                enableSpecConn();
                Services.prefs.clearUserPref( PREF_FFF_TREE + PREF_FFF_DISABLE_SPEC_CONN );
            }

            if( data.newVersion < 2.0 )
            {
                // -----------------------------------------------------------------------------------------
                // Support for these features was added in v2.0
                // If we are being downgraded to a version below that, we need to reset them to their
                // default values.
                // -----------------------------------------------------------------------------------------
                enableDNSPrefetch();
                enableLinkPrefetch();
                enablePushNotifications();
                enableWebRTCLeak();
                disableTrackingProtection();
                enableBeacon();
                enableUnifiedCompl();
            }
        }

        outer = null;
    }
};


// ---------------------------------------------------------------------------------------------------------
// Disables the 'Pocket' feature of Firefox.
// ---------------------------------------------------------------------------------------------------------
function disablePocket()
{
    // -----------------------------------------------------------------------------------------------------
    // Disabling Pocket depends on whether it is a system add-on or not.
    // If it is a system add-on, just setting PREF_BUILTIN_POCKET_ENABLED_SYS_ADDON to false is enough.
    // Else, we need to set PREF_BUILTIN_POCKET_ENABLED to false and use CustomizableUI to remove the
    // Pocket button.
    // -----------------------------------------------------------------------------------------------------


    // -----------------------------------------------------------------------------------------------------
    // Pocket was introduced as a system add-on in version POCKET_SYS_ADDON_VER.
    // Get the current version of the application and compare.
    // -----------------------------------------------------------------------------------------------------
    var appVersion = Services.appinfo.version;
    var cmp        = Services.vc.compare( appVersion, POCKET_SYS_ADDON_VER ); 
    if( cmp >= 0 )
    {
        // Pocket is a system add-on

        Services.prefs.setBoolPref( PREF_BUILTIN_POCKET_ENABLED_SYS_ADDON, false );

        // -------------------------------------------------------------------------------------------------
        // After Pocket became a system add-on, the previous pref (PREF_BUILTIN_POCKET_ENABLED) was no
        // longer used. Also, our prefs to remember location of Pocket widget are also not required anymore.
        // -------------------------------------------------------------------------------------------------
        Services.prefs.clearUserPref( PREF_BUILTIN_POCKET_ENABLED              );
        Services.prefs.clearUserPref( PREF_FFF_TREE + PREF_FFF_POCKET_AREA     );
        Services.prefs.clearUserPref( PREF_FFF_TREE + PREF_FFF_POCKET_POSITION );

    }
    else
    {
        // Pocket is not a system add-on

        // -------------------------------------------------------------------------------------------------
        // Disabling the Pocket feature involves 2 steps:
        // 1. Set the Pocket preference to false
        // 2. Remove the Pocket widget if it has been added to any toolbar
        // -------------------------------------------------------------------------------------------------

        var currentPocketPlacement = null;

        Services.prefs.setBoolPref( PREF_BUILTIN_POCKET_ENABLED, false );

        currentPocketPlacement = CustomizableUI.getPlacementOfWidget( POCKET_WIDGET );
        if( currentPocketPlacement !== null )
        {
            // ---------------------------------------------------------------------------------------------
            // Persist the location of the widget.
            // It would be used to restore the widget if Pocket is enabled.
            // ---------------------------------------------------------------------------------------------
            Services.prefs.setCharPref( PREF_FFF_TREE + PREF_FFF_POCKET_AREA,
                                        currentPocketPlacement.area );
            Services.prefs.setIntPref ( PREF_FFF_TREE + PREF_FFF_POCKET_POSITION,
                                        currentPocketPlacement.position );

            CustomizableUI.removeWidgetFromArea( POCKET_WIDGET );
        }
    }
};


// ---------------------------------------------------------------------------------------------------------
// Enables the 'Pocket' feature of Firefox.
// ---------------------------------------------------------------------------------------------------------
function enablePocket()
{
    // -----------------------------------------------------------------------------------------------------
    // Enabling Pocket depends on whether it is a system add-on or not.
    // If it is a system add-on, just resetting PREF_BUILTIN_POCKET_ENABLED_SYS_ADDON is enough.
    // Else, we need to reset PREF_BUILTIN_POCKET_ENABLED and use CustomizableUI to restore the
    // Pocket button.
    // -----------------------------------------------------------------------------------------------------


    // -----------------------------------------------------------------------------------------------------
    // Pocket was introduced as a system add-on in version POCKET_SYS_ADDON_VER.
    // Get the current version of the application and compare.
    // -----------------------------------------------------------------------------------------------------
    var appVersion = Services.appinfo.version;
    var cmp        = Services.vc.compare( appVersion, POCKET_SYS_ADDON_VER ); 
    if( cmp >= 0 )
    {
        // Pocket is a system add-on

        Services.prefs.clearUserPref( PREF_BUILTIN_POCKET_ENABLED_SYS_ADDON );

        // -------------------------------------------------------------------------------------------------
        // After Pocket became a system add-on, the previous pref (PREF_BUILTIN_POCKET_ENABLED) was no
        // longer used. Also, our prefs to remember location of Pocket widget are also not required anymore.
        // -------------------------------------------------------------------------------------------------
        Services.prefs.clearUserPref( PREF_BUILTIN_POCKET_ENABLED              );
        Services.prefs.clearUserPref( PREF_FFF_TREE + PREF_FFF_POCKET_AREA     );
        Services.prefs.clearUserPref( PREF_FFF_TREE + PREF_FFF_POCKET_POSITION );        
    }
    else
    {
        // Pocket is not a system add-on

        // -------------------------------------------------------------------------------------------------
        // Enabling the Pocket feature requires 2 steps:
        // 1. Set the Pocket preference to true
        // 2. Try to restore the pocket widget to its previous position
        // -------------------------------------------------------------------------------------------------

        var lastPocketArea      = null;
        var lastPocketPosition  = null;

        Services.prefs.setBoolPref( PREF_BUILTIN_POCKET_ENABLED, true );

        try
        {
            lastPocketArea      = Services.prefs.getCharPref( PREF_FFF_TREE + PREF_FFF_POCKET_AREA     );
            lastPocketPosition  = Services.prefs.getIntPref ( PREF_FFF_TREE + PREF_FFF_POCKET_POSITION );
        }
        catch( errLast )
        {
            // Trying to get non-existent prefs throws an exception.
            // Nothing to do here.
        }

        if( (lastPocketArea !== null) && (lastPocketPosition !== null) )
        {
            // ---------------------------------------------------------------------------------------------
            // CustomizableUI.addWidgetToArea does not really throw an error but I do see
            // the following error printed in the console:
            // "[CustomizableUI]" "Widget 'pocket-button' not found, unable to move"
            // So, just as a precaution, try-catch is used.
            // ---------------------------------------------------------------------------------------------
            try
            {
                CustomizableUI.addWidgetToArea( POCKET_WIDGET, lastPocketArea, lastPocketPosition );
            }
            catch( errAdd )
            {
            }

            // Delete the preferences since they are not required anymore.
            Services.prefs.clearUserPref( PREF_FFF_TREE + PREF_FFF_POCKET_AREA     );
            Services.prefs.clearUserPref( PREF_FFF_TREE + PREF_FFF_POCKET_POSITION );
        }
    }
};


// ---------------------------------------------------------------------------------------------------------
// Enables the 'Reader' feature of Firefox.
// ---------------------------------------------------------------------------------------------------------
function enableReader()
{
    Services.prefs.clearUserPref( PREF_BUILTIN_READER_ENABLED );
};


// ---------------------------------------------------------------------------------------------------------
// Enables the 'Hello' feature of Firefox.
// ---------------------------------------------------------------------------------------------------------
function enableHello()
{
    Services.prefs.clearUserPref( PREF_BUILTIN_HELLO_ENABLED );
};


// ---------------------------------------------------------------------------------------------------------
// Enables the 'Speculative Connections' feature of Firefox
// ---------------------------------------------------------------------------------------------------------
function enableSpecConn()
{
    Services.prefs.clearUserPref( PREF_BUILTIN_SPEC_CONN );
};


// ---------------------------------------------------------------------------------------------------------
// Disables the 'Speculative Connections' feature of Firefox
// ---------------------------------------------------------------------------------------------------------
function disableSpecConn()
{
    Services.prefs.setIntPref( PREF_BUILTIN_SPEC_CONN, SPEC_CONN_OFF_VAL );
};


// ---------------------------------------------------------------------------------------------------------
// Enables the 'DNS Prefetch' feature of Firefox
// ---------------------------------------------------------------------------------------------------------
function enableDNSPrefetch()
{
   Services.prefs.clearUserPref( PREF_BUILTIN_DNS_PREFETCH );
};


// ---------------------------------------------------------------------------------------------------------
// Enables the 'Link Prefetch' feature of Firefox
// ---------------------------------------------------------------------------------------------------------
function enableLinkPrefetch()
{
   Services.prefs.clearUserPref( PREF_BUILTIN_LINK_PREFETCH );
};


// ---------------------------------------------------------------------------------------------------------
// Enables the 'Push Notifications' feature of Firefox
// ---------------------------------------------------------------------------------------------------------
function enablePushNotifications()
{
   Services.prefs.clearUserPref( PREF_BUILTIN_PUSH_NOTIFICATIONS );
};


// ---------------------------------------------------------------------------------------------------------
// Enables the 'limit ICE candidates to the default interface only' feature of Firefox
// ---------------------------------------------------------------------------------------------------------
function enableWebRTCLeak()
{
   Services.prefs.clearUserPref( PREF_BUILTIN_WEB_RTC_LEAK );
};


// ---------------------------------------------------------------------------------------------------------
// Disables the 'Tracking Protection in non-private windows' feature of Firefox
// ---------------------------------------------------------------------------------------------------------
function disableTrackingProtection()
{
   Services.prefs.clearUserPref( PREF_BUILTIN_TRACKING_PROTECTION );
};


// ---------------------------------------------------------------------------------------------------------
// Enables the 'beacon' feature of Firefox
// ---------------------------------------------------------------------------------------------------------
function enableBeacon()
{
   Services.prefs.clearUserPref( PREF_BUILTIN_BEACON );
};


// ---------------------------------------------------------------------------------------------------------
// Enables the 'new search behavior in Firefox 43' feature of Firefox
// ---------------------------------------------------------------------------------------------------------
function enableUnifiedCompl()
{
   Services.prefs.clearUserPref( PREF_BUILTIN_UNIFIED_COMPL );
};


// ---------------------------------------------------------------------------------------------------------
// Creates and initializes custom preferences managed by the extension.
// ---------------------------------------------------------------------------------------------------------
function setDefaultPrefs()
{
    // -----------------------------------------------------------------------------------------------------
    // Try to 'get' the preference. If it is not present, NS_ERROR_UNEXPECTED would be returned.
    // Then try to create it and set its default value.
    // This mechanism takes care of all sorts of upgrade/downgrade scenarios.
    // -----------------------------------------------------------------------------------------------------
    try
    {
       Services.prefs.getBoolPref( PREF_FFF_TREE + PREF_FFF_DISABLE_POCKET, false );
    }
    catch( errPocket )
    {
       if( errPocket.name === 'NS_ERROR_UNEXPECTED' )
       {
          Services.prefs.setBoolPref( PREF_FFF_TREE + PREF_FFF_DISABLE_POCKET, false );
       }
    }


    try
    {
       Services.prefs.getBoolPref( PREF_FFF_TREE + PREF_FFF_DISABLE_SPEC_CONN, false );
    }
    catch( errSpecConn )
    {
       if( errSpecConn.name === 'NS_ERROR_UNEXPECTED' )
       {
          Services.prefs.setBoolPref( PREF_FFF_TREE + PREF_FFF_DISABLE_SPEC_CONN, false );
       }
    }

    // -----------------------------------------------------------------------------------------------------
    // Do not create PREF_FFF_POCKET_AREA and PREF_FFF_POCKET_POSITION preferences. 
    // They will be created just-in-time when required.
    // -----------------------------------------------------------------------------------------------------
};


// ---------------------------------------------------------------------------------------------------------
// Deletes all preferences managed by the extension.
// ---------------------------------------------------------------------------------------------------------
function deleteAllPrefs()
{
    Services.prefs.clearUserPref( PREF_FFF_TREE + PREF_FFF_DISABLE_POCKET    );
    Services.prefs.clearUserPref( PREF_FFF_TREE + PREF_FFF_POCKET_AREA       );
    Services.prefs.clearUserPref( PREF_FFF_TREE + PREF_FFF_POCKET_POSITION   );
    Services.prefs.clearUserPref( PREF_FFF_TREE + PREF_FFF_DISABLE_SPEC_CONN );
};


// ---------------------------------------------------------------------------------------------------------
// Observer for changes in preferences.
// ---------------------------------------------------------------------------------------------------------
var prefObserver = 
{
    observe: function( subject, topic, data )
    {
        var newValue = null;

        if( ("nsPref:changed" === topic) && (data === PREF_FFF_DISABLE_POCKET) )
        {
            newValue = subject.getBoolPref( data );
            if( true === newValue )
            {
                disablePocket();
            }
            else
            {
                enablePocket();
            }
        }
        else if( ("nsPref:changed" === topic) && (data === PREF_FFF_DISABLE_SPEC_CONN) )
        {
            newValue = subject.getBoolPref( data );
            if( true === newValue )
            {
                disableSpecConn();
            }
            else
            {
                enableSpecConn();
            }
        }
        
    }
};


// ---------------------------------------------------------------------------------------------------------
// Helper logging function
// ---------------------------------------------------------------------------------------------------------
function logMsg( message )
{
    // Use console.log method if it is available
    if( outer.console && 
        outer.console.log )
    {
        outer.console.log( LOG_MSG_PREFIX + message );
    }
};

