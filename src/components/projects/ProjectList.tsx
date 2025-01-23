import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import ProjectCard from "./ProjectCard";
import CreateProjectDialog from "./CreateProjectDialog";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Database } from "@/integrations/supabase/types";

type DatabaseProject = Database['public']['Tables']['projects']['Row'];

interface Project extends Omit<DatabaseProject, 'business_idea'> {
  business_idea: {
    description: string;
    valueProposition: string;
  } | null;
}

interface ProjectListProps {
  onStartAdWizard: (projectId?: string) => void;
}

const ProjectList = ({ onStartAdWizard }: ProjectListProps) => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { toast } = useToast();

  // Query to check free tier usage
  const { data: freeUsage } = useQuery({
    queryKey: ["free_tier_usage"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("free_tier_usage")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        console.error('Error fetching free tier usage:', error);
        return null;
      }

      return data;
    },
  });

  // Query to check if user has an active subscription
  const { data: subscription } = useQuery({
    queryKey: ["subscription"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .eq("active", true)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        console.error('Error fetching subscription:', error);
        return null;
      }

      return data;
    },
  });

  const { data: projects, refetch, error, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("User not authenticated");
      }

      // Add distinct on title to prevent duplicates
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq('user_id', user.id)
        .order("created_at", { ascending: false });

      if (error) {
        toast({
          title: "Error fetching projects",
          description: error.message,
          variant: "destructive",
        });
        throw error;
      }

      // Filter out potential duplicates based on title and creation time
      const uniqueProjects = data.reduce((acc: DatabaseProject[], current) => {
        const isDuplicate = acc.find(
          (item) => 
            item.title === current.title && 
            Math.abs(new Date(item.created_at).getTime() - new Date(current.created_at).getTime()) < 1000
        );
        if (!isDuplicate) {
          acc.push(current);
        }
        return acc;
      }, []);

      return uniqueProjects.map(project => ({
        ...project,
        business_idea: project.business_idea as Project['business_idea']
      }));
    },
  });

  const handleCreateProject = () => {
    setIsCreateOpen(true);
  };

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500">Error loading projects. Please try again later.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <p>Loading projects...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Your Projects</h2>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Button 
            onClick={() => onStartAdWizard()} 
            className="w-full sm:w-auto whitespace-nowrap"
          >
            <Plus className="mr-2 h-4 w-4" /> New Ad Campaign
          </Button>
          <Button 
            onClick={handleCreateProject} 
            variant="outline"
            className="w-full sm:w-auto whitespace-nowrap"
          >
            <Plus className="mr-2 h-4 w-4" /> New Project
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {projects?.map((project) => (
          <ProjectCard 
            key={project.id} 
            project={project} 
            onUpdate={refetch}
            onStartAdWizard={() => onStartAdWizard(project.id)} 
          />
        ))}
      </div>

      <CreateProjectDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSuccess={() => {
          refetch();
          setIsCreateOpen(false);
        }}
        onStartAdWizard={onStartAdWizard}
      />
    </div>
  );
};

export default ProjectList;