import { Link } from "react-router";
import { BellIcon, Users2Icon, UsersIcon } from "lucide-react";

const HomePage = () => {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="container mx-auto max-w-4xl space-y-8">
        <section className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Welcome to Learning Room</h1>
          <p className="opacity-70">
            A simple place to practice languages with friends, groups, and real conversations.
          </p>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card bg-base-200">
            <div className="card-body p-5">
              <div className="flex items-center gap-2">
                <UsersIcon className="size-5 text-primary" />
                <h2 className="font-semibold">Friends</h2>
              </div>
              <p className="text-sm opacity-70 mt-2">Find language partners and manage your friend list.</p>
              <div className="card-actions justify-end mt-4">
                <Link to="/friends" className="btn btn-primary btn-sm">Open</Link>
              </div>
            </div>
          </div>

          <div className="card bg-base-200">
            <div className="card-body p-5">
              <div className="flex items-center gap-2">
                <Users2Icon className="size-5 text-primary" />
                <h2 className="font-semibold">Groups</h2>
              </div>
              <p className="text-sm opacity-70 mt-2">Join group rooms to chat and learn together.</p>
              <div className="card-actions justify-end mt-4">
                <Link to="/groups" className="btn btn-primary btn-sm">Open</Link>
              </div>
            </div>
          </div>

          <div className="card bg-base-200">
            <div className="card-body p-5">
              <div className="flex items-center gap-2">
                <BellIcon className="size-5 text-primary" />
                <h2 className="font-semibold">Notifications</h2>
              </div>
              <p className="text-sm opacity-70 mt-2">See friend requests and group invites.</p>
              <div className="card-actions justify-end mt-4">
                <Link to="/notifications" className="btn btn-primary btn-sm">Open</Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default HomePage;
