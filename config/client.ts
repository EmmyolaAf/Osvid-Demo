/**
 * Client Installation Configuration
 * Defines the stable identity and provider-governance metadata for this installation.
 * 
 * Grounded strictly in repository configuration (.firebaserc / Firebase project):
 * - Project ID: osvid-9d4d6
 * - Hosting Site: osvid.web.app
 * - Client ID: osvid
 */

export interface ClientInstallationConfig {
  clientId: string;
  clientName: string;
  businessName: string;
  firebaseProjectId: string;
  hostingSite: string;
  primaryDomain?: string;
  defaultAdminEmail?: string;
  version?: string;
  plan?: string;
  controlPlaneReady?: boolean;
}

export const OSVID_CLIENT_CONFIG: ClientInstallationConfig = {
  clientId: "osvid",
  clientName: "OSVID Chemicals Limited",
  businessName: "OSVID Chemicals",
  firebaseProjectId: "osvid-9d4d6",
  hostingSite: "osvid.web.app",
  primaryDomain: undefined,
  defaultAdminEmail: undefined,
  version: undefined,
  plan: undefined,
  controlPlaneReady: false,
};
