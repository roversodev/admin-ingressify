
"use client";

import { useEffect, useState } from "react";
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


export default function RootLayout({
  children,
  actionButtons,
}: Readonly<{
  children: React.ReactNode;
  actionButtons?: React.ReactNode;
}>) {
  // const { user, isLoaded } = useUser();
  // const router = useRouter()
  // const [isChecking, setIsChecking] = useState(true);
  // if(!user){
  //   router.push('/sign-in')
  // }
  
  // // Verificar status de administrador
  // const adminStatus = useQuery(api.admin.checkAdminStatus, 
  //   user?.id ? { userId: user.id } : "skip"
  // );

  // useEffect(() => {
  //   // Aguardar o carregamento do usuário e a verificação do status de admin
  //   if (isLoaded && adminStatus !== undefined) {
  //     setIsChecking(false);
      
  //     // Se não for admin ou não tiver permissões, redirecionar
  //     if (!adminStatus || !adminStatus.isAdmin) {
  //       toast.error("Você não tem permissão para acessar o painel administrativo");
  //       window.location.href = "https://ingressify.com.br";
  //     }

  //     if (adminStatus.isAdmin) {
  //       toast.success("Bem-vindo ao painel administrativo");
  //     }
  //   }
  // }, [isLoaded, adminStatus]);

  // // Mostrar tela de carregamento enquanto verifica
  // if (isChecking) {
  //   return (
  //     <Spinner />
  //   );
  // }

  //  if (!adminStatus || !adminStatus.isAdmin) {
  //   return null;
  // }

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
                {actionButtons}
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
