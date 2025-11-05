
"use client";

import { ReactNode, useEffect, useState } from "react";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ActionButtons } from "@/components/action-buttons";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/api";
import { toast } from "sonner";
import Spinner from "@/components/Spinner";
import { useRouter } from "next/navigation";

export default function AdmLayout({ children }: { children: ReactNode }){
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  // Remova o redirecionamento imediato durante o render:
  // if(!user){
  //   router.push('/sign-in')
  // }
  
  useEffect(() => {
    if (!isLoaded) return;
    // Se não logado, vá para sign-in e preserve a rota atual para voltar depois do login
    if (!user) {
      const target = window.location.pathname + window.location.search;
      router.replace(`/sign-in?redirect_url=${encodeURIComponent(target)}`);
      return;
    }
  }, [isLoaded, user, router]);

  // Verificar status de administrador (já usa "skip" quando não há userId)
  const adminStatus = useQuery(api.admin.checkAdminStatus, user?.id ? { userId: user.id } : "skip");

  useEffect(() => {
    // Aguarde usuário carregado e adminStatus pronto
    if (!isLoaded || !user) return;
    if (adminStatus === undefined) return;

    setIsChecking(false);

    if (!adminStatus || !adminStatus.isAdmin) {
      toast.error("Você não tem permissão para acessar o painel administrativo");
      // Use replace para evitar loop no histórico; escolha a rota de fallback
      router.replace("/");
      return;
    }

    // Opcional: evite toast de boas-vindas em cada reload
    // toast.success("Bem-vindo ao painel administrativo");
  }, [isLoaded, user, adminStatus, router]);

  if (isChecking) {
    return <Spinner />;
  }

  if (!adminStatus || !adminStatus.isAdmin) {
    return null;
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="px-4 md:px-6 lg:px-8 @container">
          <div className="w-full max-w-6xl mx-auto">
            <header className="flex flex-wrap gap-3 min-h-20 py-4 shrink-0 items-center transition-all ease-linear border-b">
              {/* Left side */}
              <div className="flex flex-1 items-center gap-2">
                <SidebarTrigger className="-ms-1" />
                <div className="max-lg:hidden lg:contents">
                  <Separator
                    orientation="vertical"
                    className="me-2 data-[orientation=vertical]:h-4"
                  />
                  <Breadcrumb>
                    <BreadcrumbList>
                      <BreadcrumbItem className="hidden md:block">
                        <BreadcrumbLink href="#">Home</BreadcrumbLink>
                      </BreadcrumbItem>
                      <BreadcrumbSeparator className="hidden md:block" />
                      <BreadcrumbItem>
                        <BreadcrumbPage>Dashboard</BreadcrumbPage>
                      </BreadcrumbItem>
                    </BreadcrumbList>
                  </Breadcrumb>
                </div>
              </div>
              {/* Right side */}
              <ActionButtons showDefaultButtons={false}>
              </ActionButtons>
            </header>
            <div className="overflow-hidden">
              {children}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
