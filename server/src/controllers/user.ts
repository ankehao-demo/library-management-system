import { getSupabase } from '../database.js';
import { User } from '../models/user.js';

class UserController {
    public async createNewUser(): Promise<User> {
        const supabase = getSupabase();

        const adjectives = ['Abrasive', 'Brash', 'Callous', 'Daft', 'Eccentric', 'Fiesty', 'Golden', 'Happy', 'Ignominious', 'Joltin', 'Chill', 'Luminous', 'Mushy', 'Cool', 'OldSchool', 'Pompous', 'Quiet', 'Rowdy', 'Sneaky', 'Tawdry'];
        const animals = ['Alligator', 'Barracuda', 'Cheetah', 'Dingo', 'Elephant', 'Falcon', 'Gorilla', 'Hyena', 'Iguana', 'Jaguar', 'Koala', 'Lemur', 'Mongoose', 'Narwhal', 'Orangutan', 'Platypus', 'Quetzal', 'Rhino', 'Scorpion', 'Tarantula'];
        const randomUsername = `${adjectives[Math.floor(Math.random() * 20)]} ${animals[Math.floor(Math.random() * 20)]}`;

        const { data: existingUser } = await supabase
            .from('users')
            .select('*')
            .eq('name', randomUsername)
            .single();

        if (existingUser) {
            return existingUser;
        }

        const { data: newUser, error } = await supabase
            .from('users')
            .insert({ name: randomUsername, is_admin: true })
            .select()
            .single();

        if (error || !newUser) {
            console.error('Error creating user:', error);
            throw new Error('Unable to create user');
        }

        return newUser;
    }

    public async getUser(username: string): Promise<User | null> {
        const supabase = getSupabase();

        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('name', username)
            .single();

        if (error || !user) {
            return null;
        }

        return user;
    }

    public async getUserById(userId: string): Promise<User | null> {
        const supabase = getSupabase();

        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (error || !user) {
            return null;
        }

        return user;
    }
}

export default UserController;
