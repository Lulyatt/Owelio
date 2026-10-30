import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, LogOut } from "lucide-react";
import { api, useAction, useMe } from "@/lib/app";
import { Button } from "@/components/ui/button";

export function AppHeader() {
  const me = useMe();
  const navigate = useNavigate();
  const notes = useQuery({ queryKey: ["notifications"], queryFn: () => api().notifications.list(), enabled: !!me.data });
  const unread = notes.data?.filter((n) => !n.read).length ?? 0;
  const logout = useAction(() => api().auth.logout());

  return (
    <header className="border-b bg-card/70 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link to="/" className="font-display text-2xl font-bold text-primary">
          tally<span className="text-accent-foreground">.</span>
        </Link>
        {me.data && (
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:inline">{me.data.name}</span>
            <Button asChild variant="ghost" size="icon" aria-label="Notifications" className="relative">
              <Link to="/notifications">
                <Bell />
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                    {unread}
                  </span>
                )}
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Log out"
              onClick={async () => {
                await logout.mutateAsync(undefined);
                navigate({ to: "/login", search: { redirect: undefined } });
              }}
            >
              <LogOut />
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
