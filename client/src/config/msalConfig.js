import { PublicClientApplication } from '@azure/msal-browser';

/**
 * MSAL Configuration for Azure DevOps Authentication
 * Azure DevOps uses OAuth 2.0 with Microsoft identity platform
 */

// Azure DevOps OAuth Configuration
// Using root redirect URI for better compatibility
export const devopsMsalConfig = {
  auth: {
    clientId: process.env.REACT_APP_AZURE_CLIENT_ID || '574a70af-933c-4b26-a2be-34b4249bf9f6',
    authority: `https://login.microsoftonline.com/${process.env.REACT_APP_AZURE_TENANT_ID || '8c3dad1d-b6bc-4f8b-939b-8263372eced6'}`,
    redirectUri: window.location.origin, // Use root URI - more compatible
    postLogoutRedirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage', // This configures where your cache will be stored
    storeAuthStateInCookie: false, // Set this to "true" if you are having issues on IE11 or Edge
  },
};

// Scopes required for Azure DevOps
export const devopsLoginRequest = {
  scopes: [
    '499b84ac-1321-427f-aa17-267ca6975798/user_impersonation', // Azure DevOps user_impersonation scope
    'offline_access', // Optional: for refresh tokens
  ],
};

// Create MSAL instance
export const devopsMsalInstance = new PublicClientApplication(devopsMsalConfig);

// Initialize MSAL
devopsMsalInstance.initialize().then(() => {
  console.log('✅ MSAL initialized for Azure DevOps');
}).catch((error) => {
  console.error('❌ MSAL initialization failed:', error);
});

export default devopsMsalInstance;

