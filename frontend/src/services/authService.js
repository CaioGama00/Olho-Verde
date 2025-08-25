import supabase from '../utils/supabase';

const register = async (name, email, password) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
      },
    },
  });
  return { data, error };
};

const login = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
};

const logout = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

const getUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
};

const onAuthStateChange = (callback) => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        callback(session?.user ?? null);
    });
    return subscription;
}

export default {
  register,
  login,
  logout,
  getUser,
  onAuthStateChange
};
