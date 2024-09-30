import { GitHub } from "arctic";
export declare const github: {
    id: string;
    displayName: string;
    env: Record<"GITHUB_CLIENT_ID" | "GITHUB_CLIENT_SECRET", string>;
    oAuthClient: GitHub;
};
