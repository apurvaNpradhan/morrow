export type BanState = {
  banned?: boolean | null;
  banExpires?: Date | string | null;
};

export function isBanActive(user: BanState | null | undefined) {
  if (!user?.banned) {
    return false;
  }
  if (!user.banExpires) {
    return true;
  }
  return new Date(user.banExpires).getTime() >= Date.now();
}
