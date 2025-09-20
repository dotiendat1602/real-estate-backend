export type WebAppUser = {
  id: number;
  is_bot?: boolean;
  firstName: string;
  lastName?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  added_to_attachment_menu?: boolean;
  allows_write_to_pm?: boolean;
  photoUrl?: string;
};
