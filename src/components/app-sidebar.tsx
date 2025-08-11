"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  RiSlowDownLine,
  RiLeafLine,
  RiCalendarEventLine,
  RiBankLine,
  RiCoupon3Line,
  RiShieldUserLine
} from "@remixicon/react";
import Image from "next/image";
import { useUser } from "@clerk/nextjs";


function SidebarLogo() {
  const id = React.useId();
  return (
    <div className="flex gap-2 px-2 group-data-[collapsible=icon]:px-0 transition-[padding] duration-200 ease-in-out">
      <Link className="group/logo inline-flex" href="/">
        <Image
          src="/logo.png"
          alt="logo"
          width={132}
          height={132}
          className="group-data-[collapsible=icon]:hidden"
        />
        <Image
          src="/icon.png"
          alt="logo"
          width={32}
          height={32}
          className="group-data-[collapsible=icon]:block hidden"
        />
      </Link>
    </div>
  );
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useUser();
  const pathname = usePathname();
  
  const data = {
    user: {
      name: user?.fullName || "Vitor Roverso",
      email: user?.emailAddresses[0].emailAddress || "vitorroverso40@gmail.com",
      avatar: user?.imageUrl || "https://raw.githubusercontent.com/origin-space/origin-images/refs/heads/main/exp3/user_itiiaq.png",
    },
    navMain: [
      {
        title: "General",
        items: [
          {
            title: "Dashboard",
            url: "/",
            icon: RiSlowDownLine,
          },
          {
            title: "Transações",
            url: "#",
            icon: RiLeafLine,
          },
          {
            title: "Usuários",
            url: "/usuarios",
            icon: RiShieldUserLine,
          },
          {
            title: "Eventos",
            url: "#",
            icon: RiCalendarEventLine,
          },
          {
            title: "Ingressos",
            url: "#",
            icon: RiCoupon3Line,
          },
          {
            title: "Financeiro",
            url: "#",
            icon: RiBankLine,
          },
        ],
      },
    ],
  };
  return (
    <Sidebar collapsible="icon" variant="inset" {...props}>
      <SidebarHeader className="h-16 max-md:mt-2 mb-2 justify-center">
        <SidebarLogo />
      </SidebarHeader>
      <SidebarContent className="-mt-2">
        {data.navMain.map((item) => (
          <SidebarGroup key={item.title}>
            <SidebarGroupLabel className="uppercase text-muted-foreground/65">
              {item.title}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {item.items.map((item) => {
                  // Verifica se o item está ativo com base na URL atual
                  const isActive = 
                    (item.url === "/" && pathname === "/") || 
                    (item.url !== "/" && pathname.startsWith(item.url));
                  
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        className="group/menu-button group-data-[collapsible=icon]:px-[5px]! font-medium gap-3 h-9 [&>svg]:size-auto"
                        tooltip={item.title}
                        isActive={isActive}
                      >
                        <Link href={item.url}>
                          {item.icon && (
                            <item.icon
                              className="text-muted-foreground/65 group-data-[active=true]/menu-button:text-primary"
                              size={22}
                              aria-hidden="true"
                            />
                          )}
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  );
}
