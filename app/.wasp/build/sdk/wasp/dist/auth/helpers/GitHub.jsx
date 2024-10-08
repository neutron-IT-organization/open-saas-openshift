import { config } from 'wasp/client';
import { SocialButton } from '../forms/internal/social/SocialButton';
import * as SocialIcons from '../forms/internal/social/SocialIcons';
// PUBLIC API
export const signInUrl = `${config.apiUrl}/auth/github/login`;
// PUBLIC API
export function SignInButton() {
    return (<SocialButton href={signInUrl}>
      <SocialIcons.GitHub />
    </SocialButton>);
}
//# sourceMappingURL=GitHub.jsx.map