import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  clearToken,
  fetchCurrentUser,
  getToken,
  postJson,
  saveToken,
} from "./api";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

// The server said the token is not valid (not just a network problem)
const isRejected = (error) => error?.status === 401 || error?.status === 403;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  // Restore the session when the app opens (same as the website)
  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const token = await getToken();
        if (token) {
          const me = await fetchCurrentUser(token);
          if (active) setUser(me);
        }
      } catch (error) {
        // Only forget the token when the server rejects it.
        // A short network problem should not log the person out.
        if (isRejected(error)) await clearToken();
      } finally {
        if (active) setAuthReady(true);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await postJson("/auth/login", {
      email: email.trim(),
      password,
    });

    if (!data?.access_token) {
      throw new Error("The server did not return a login token.");
    }

    await saveToken(data.access_token);

    try {
      const me = await fetchCurrentUser(data.access_token);
      setUser(me);
      return me;
    } catch (error) {
      await clearToken();
      throw new Error(
        `Logged in, but the server rejected your session: ${error.message}`,
      );
    }
  }, []);

  // Same payload as the website: first word = first name, the rest = last name ("-" if empty)
  const register = useCallback(
    async ({ name, email, password }) => {
      const [firstName, ...rest] = name.trim().split(/\s+/);

      await postJson("/auth/register", {
        first_name: firstName,
        last_name: rest.join(" ") || "-",
        email: email.trim(),
        password,
      });

      try {
        return await login(email, password); // log the new user in straight away
      } catch {
        throw new Error(
          "Your account was created, but we couldn’t log you in automatically. Please log in.",
        );
      }
    },
    [login],
  );

  const logout = useCallback(async () => {
    await clearToken();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, authReady, login, register, logout }),
    [user, authReady, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
