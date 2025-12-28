import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
  Search, 
  MoreHorizontal, 
  UserPlus, 
  Download, 
  Filter, 
  Mail, 
  ShieldAlert, 
  Ban, 
  Edit, 
  Trash,
  CheckCircle
} from "lucide-react";

// Type definition for user data
interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
  subscription: string | null;
  status: string | null;
  lastLogin: string | null;
  createdAt: string;
  avatarUrl?: string;
}

export function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [subscriptionFilter, setSubscriptionFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    // Update filtered users when filters change
    let results = users;
    
    // Apply search term filter
    if (searchTerm) {
      results = results.filter(user => 
        (user.name?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Apply status filter
    if (statusFilter !== "all") {
      results = results.filter(user => user.status === statusFilter);
    }
    
    // Apply subscription filter
    if (subscriptionFilter !== "all") {
      results = results.filter(user => user.subscription === subscriptionFilter);
    }
    
    setFilteredUsers(results);
  }, [users, searchTerm, statusFilter, subscriptionFilter]);

  // Fetch real users from the database
  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Get users data using what's available from client-side
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select(`
          id,
          email,
          created_at,
          updated_at
        `);
      
      if (userError) throw userError;
      
      // Fetch user subscriptions
      const { data: subscriptions, error: subError } = await supabase
        .from('user_subscriptions')
        .select(`
          user_id,
          status,
          plan_id,
          email,
          access_level
        `);
      
      if (subError) {
        console.error("Error fetching subscriptions:", subError);
      }
      
      // Create a map for user subscriptions
      const subMap = new Map();
      if (subscriptions) {
        subscriptions.forEach(sub => {
          subMap.set(sub.user_id, sub);
        });
      }
      
      if (userData) {
        // Transform user data to UI format
        const formattedUsers: User[] = userData.map(user => {
          const sub = subMap.get(user.id);
          
          // Get a name from email if no other name available
          const displayName = user.email.split('@')[0];
          
          return {
            id: user.id,
            email: user.email || '',
            name: displayName,
            role: sub?.access_level === 'admin' ? 'admin' : 'user',
            subscription: sub?.access_level || 'free',
            status: sub?.status || 'inactive',
            lastLogin: null, // We don't have this from client-side
            createdAt: user.created_at,
            avatarUrl: null // We don't have this from client-side
          };
        });
        
        setUsers(formattedUsers);
      }
    } catch (err) {
      console.error("Error fetching users:", err);
      setError("Failed to load users. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUserAction = async (action: string, user: User) => {
    switch (action) {
      case "view":
        setSelectedUser(user);
        setShowUserDialog(true);
        break;
      case "edit":
        // In a real app, this would open an edit form
        alert(`Edit user: ${user.name || user.email}`);
        break;
      case "delete":
        // In a real app, this would show a confirmation dialog
        if (window.confirm(`Are you sure you want to delete ${user.name || user.email}?`)) {
          // Then delete the user
          alert("User deletion would be implemented with proper admin privileges");
        }
        break;
      case "suspend":
        try {
          const newStatus = user.status === "active" ? "inactive" : "active";
          // Update user_subscriptions status
          const { error } = await supabase
            .from('user_subscriptions')
            .update({ status: newStatus })
            .eq('user_id', user.id);
          
          if (error) throw error;
          
          // Update the local state
          const updatedUsers = users.map(u => 
            u.id === user.id ? { ...u, status: newStatus } : u
          );
          setUsers(updatedUsers);
        } catch (err) {
          console.error("Error updating user status:", err);
          alert("Failed to update user status. Please try again.");
        }
        break;
      case "promote":
        alert("User promotion to admin would require proper authorization");
        break;
      default:
        break;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    }).format(date);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Users</h2>
          <p className="text-muted-foreground">
            Manage user accounts and permissions
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex items-center gap-1">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button className="flex items-center gap-1">
            <UserPlus className="h-4 w-4" />
            Add User
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-1">
                    <Filter className="h-4 w-4" />
                    Status: {statusFilter === "all" ? "All" : statusFilter}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setStatusFilter("all")}>
                    All
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter("active")}>
                    Active
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter("inactive")}>
                    Inactive
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter("trial")}>
                    Trial
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-1">
                    <Filter className="h-4 w-4" />
                    Plan: {subscriptionFilter === "all" ? "All" : subscriptionFilter}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setSubscriptionFilter("all")}>
                    All
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSubscriptionFilter("free")}>
                    Free
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSubscriptionFilter("pro")}>
                    Pro
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSubscriptionFilter("enterprise")}>
                    Enterprise
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <Button 
                variant="outline" 
                onClick={fetchUsers} 
                disabled={isLoading}
              >
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Users Table */}
      <Card>
        <CardHeader className="p-6">
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            {filteredUsers.length} users found
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {error && (
            <div className="p-4 text-red-500 bg-red-50 border border-red-100 rounded m-4">
              {error}
            </div>
          )}
          
          {isLoading ? (
            <div className="flex justify-center items-center h-24">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length > 0 ? filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {user.avatarUrl && (
                          <img 
                            src={user.avatarUrl} 
                            alt={user.name || user.email} 
                            className="h-8 w-8 rounded-full"
                          />
                        )}
                        <div>
                          <div>{user.name || user.email.split('@')[0]}</div>
                          <div className="text-sm text-muted-foreground">{user.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.role === "admin" ? (
                        <Badge variant="destructive">Admin</Badge>
                      ) : (
                        <Badge variant="outline">User</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.status === "active" ? (
                        <Badge variant="success" className="bg-green-500">Active</Badge>
                      ) : user.status === "trial" ? (
                        <Badge variant="secondary" className="bg-blue-500 text-white">Trial</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.subscription === "pro" ? (
                        <Badge variant="default">Pro</Badge>
                      ) : user.subscription === "enterprise" ? (
                        <Badge variant="destructive">Enterprise</Badge>
                      ) : (
                        <Badge variant="outline">Free</Badge>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(user.lastLogin)}</TableCell>
                    <TableCell>{formatDate(user.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleUserAction("view", user)}>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            View details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleUserAction("edit", user)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit user
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleUserAction("suspend", user)}>
                            {user.status === "active" ? (
                              <>
                                <Ban className="mr-2 h-4 w-4" />
                                Suspend user
                              </>
                            ) : (
                              <>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Activate user
                              </>
                            )}
                          </DropdownMenuItem>
                          {user.role !== "admin" && (
                            <DropdownMenuItem onClick={() => handleUserAction("promote", user)}>
                              <ShieldAlert className="mr-2 h-4 w-4" />
                              Make admin
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleUserAction("mail", user)}>
                            <Mail className="mr-2 h-4 w-4" />
                            Send email
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleUserAction("delete", user)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash className="mr-2 h-4 w-4" />
                            Delete user
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      {searchTerm || statusFilter !== "all" || subscriptionFilter !== "all" 
                        ? "No users match your filters."
                        : "No users found."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* User Details Dialog */}
      {selectedUser && (
        <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>User Details</DialogTitle>
              <DialogDescription>
                Complete information about the user.
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              {selectedUser.avatarUrl && (
                <div className="flex justify-center">
                  <img 
                    src={selectedUser.avatarUrl} 
                    alt={selectedUser.name || selectedUser.email} 
                    className="h-24 w-24 rounded-full"
                  />
                </div>
              )}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Name</Label>
                <div className="col-span-3">{selectedUser.name || 'Not provided'}</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Email</Label>
                <div className="col-span-3">{selectedUser.email}</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">User ID</Label>
                <div className="col-span-3 text-xs font-mono">{selectedUser.id}</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Role</Label>
                <div className="col-span-3">
                  {selectedUser.role === "admin" ? (
                    <Badge variant="destructive">Admin</Badge>
                  ) : (
                    <Badge variant="outline">User</Badge>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Status</Label>
                <div className="col-span-3">
                  {selectedUser.status === "active" ? (
                    <Badge variant="success" className="bg-green-500">Active</Badge>
                  ) : selectedUser.status === "trial" ? (
                    <Badge variant="secondary" className="bg-blue-500 text-white">Trial</Badge>
                  ) : (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Plan</Label>
                <div className="col-span-3">
                  {selectedUser.subscription === "pro" ? (
                    <Badge variant="default">Pro</Badge>
                  ) : selectedUser.subscription === "enterprise" ? (
                    <Badge variant="destructive">Enterprise</Badge>
                  ) : (
                    <Badge variant="outline">Free</Badge>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Last Login</Label>
                <div className="col-span-3">{formatDate(selectedUser.lastLogin)}</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Joined</Label>
                <div className="col-span-3">{formatDate(selectedUser.createdAt)}</div>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowUserDialog(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
} 