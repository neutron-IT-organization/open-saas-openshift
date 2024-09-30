import { useEffect } from 'react';
import { useHistory } from 'react-router-dom';
export function useRedirectHomeUnlessUserIsAdmin({ user }) {
    const history = useHistory();
    useEffect(() => {
        if (!user.isAdmin) {
            history.push('/');
        }
    }, [user, history]);
}
//# sourceMappingURL=useRedirectHomeUnlessUserIsAdmin.js.map