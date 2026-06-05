export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      album_items: {
        Row: {
          album_id: string
          community_id: string
          created_at: string
          created_by: string
          id: string
          kind: Database["public"]["Enums"]["album_item_kind"]
          media_url: string | null
          title: string
        }
        Insert: {
          album_id: string
          community_id: string
          created_at?: string
          created_by: string
          id?: string
          kind?: Database["public"]["Enums"]["album_item_kind"]
          media_url?: string | null
          title: string
        }
        Update: {
          album_id?: string
          community_id?: string
          created_at?: string
          created_by?: string
          id?: string
          kind?: Database["public"]["Enums"]["album_item_kind"]
          media_url?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "album_items_album_id_community_id_fkey"
            columns: ["album_id", "community_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id", "community_id"]
          },
          {
            foreignKeyName: "album_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      one_second_logs: {
        Row: {
          id: string
          community_id: string
          user_id: string
          video_url: string
          caption: string
          created_at: string
        }
        Insert: {
          id?: string
          community_id: string
          user_id: string
          video_url: string
          caption?: string
          created_at?: string
        }
        Update: {
          id?: string
          community_id?: string
          user_id?: string
          video_url?: string
          caption?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "one_second_logs_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "one_second_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      albums: {
        Row: {
          community_id: string
          cover_url: string | null
          created_at: string
          created_by: string
          description: string
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          community_id: string
          cover_url?: string | null
          created_at?: string
          created_by: string
          description?: string
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          community_id?: string
          cover_url?: string | null
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "albums_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "albums_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          community_id: string
          created_at: string
          created_by: string
          ends_at: string | null
          id: string
          location: string
          notes: string
          starts_at: string
          title: string
          updated_at: string
        }
        Insert: {
          community_id: string
          created_at?: string
          created_by: string
          ends_at?: string | null
          id?: string
          location?: string
          notes?: string
          starts_at: string
          title: string
          updated_at?: string
        }
        Update: {
          community_id?: string
          created_at?: string
          created_by?: string
          ends_at?: string | null
          id?: string
          location?: string
          notes?: string
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_members: {
        Row: {
          circle_id: string
          community_id: string
          created_at: string
          id: string
          member_id: string
        }
        Insert: {
          circle_id: string
          community_id: string
          created_at?: string
          id?: string
          member_id: string
        }
        Update: {
          circle_id?: string
          community_id?: string
          created_at?: string
          id?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_members_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "circle_members_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "circle_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "community_members"
            referencedColumns: ["id"]
          },
        ]
      }
      circles: {
        Row: {
          community_id: string
          created_at: string
          created_by: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          community_id: string
          created_at?: string
          created_by: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          community_id?: string
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "circles_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "circles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      commitment_assignees: {
        Row: {
          commitment_id: string
          community_id: string
          created_at: string
          id: string
          member_id: string
        }
        Insert: {
          commitment_id: string
          community_id: string
          created_at?: string
          id?: string
          member_id: string
        }
        Update: {
          commitment_id?: string
          community_id?: string
          created_at?: string
          id?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commitment_assignees_commitment_id_fkey"
            columns: ["commitment_id"]
            isOneToOne: false
            referencedRelation: "commitments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commitment_assignees_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commitment_assignees_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "community_members"
            referencedColumns: ["id"]
          },
        ]
      }
      commitments: {
        Row: {
          circle_id: string | null
          community_id: string
          completed_at: string | null
          created_at: string
          created_by: string
          due_at: string
          id: string
          note: string
          pair_id: string | null
          status: string
          title: string
          updated_at: string
          visibility_type: string
        }
        Insert: {
          circle_id?: string | null
          community_id: string
          completed_at?: string | null
          created_at?: string
          created_by: string
          due_at: string
          id?: string
          note?: string
          pair_id?: string | null
          status?: string
          title: string
          updated_at?: string
          visibility_type?: string
        }
        Update: {
          circle_id?: string | null
          community_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string
          due_at?: string
          id?: string
          note?: string
          pair_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          visibility_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "commitments_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commitments_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commitments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commitments_pair_id_fkey"
            columns: ["pair_id"]
            isOneToOne: false
            referencedRelation: "relationship_pairs"
            referencedColumns: ["id"]
          },
        ]
      }
      communities: {
        Row: {
          accent: string
          cover_url: string | null
          created_at: string
          created_by: string
          description: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          accent?: string
          cover_url?: string | null
          created_at?: string
          created_by: string
          description?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          accent?: string
          cover_url?: string | null
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_members: {
        Row: {
          community_id: string
          id: string
          joined_at: string
          role: Database["public"]["Enums"]["community_role"]
          user_id: string
        }
        Insert: {
          community_id: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["community_role"]
          user_id: string
        }
        Update: {
          community_id?: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["community_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_members_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ddays: {
        Row: {
          community_id: string
          created_at: string
          created_by: string
          id: string
          kind: Database["public"]["Enums"]["dday_kind"]
          note: string
          target_date: string
          title: string
          updated_at: string
        }
        Insert: {
          community_id: string
          created_at?: string
          created_by: string
          id?: string
          kind?: Database["public"]["Enums"]["dday_kind"]
          note?: string
          target_date: string
          title: string
          updated_at?: string
        }
        Update: {
          community_id?: string
          created_at?: string
          created_by?: string
          id?: string
          kind?: Database["public"]["Enums"]["dday_kind"]
          note?: string
          target_date?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ddays_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ddays_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_codes: {
        Row: {
          code: string
          community_id: string
          created_at: string
          created_by: string
          disabled_at: string | null
          expires_at: string | null
          id: string
          max_uses: number | null
          use_count: number
        }
        Insert: {
          code: string
          community_id: string
          created_at?: string
          created_by: string
          disabled_at?: string | null
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          use_count?: number
        }
        Update: {
          code?: string
          community_id?: string
          created_at?: string
          created_by?: string
          disabled_at?: string | null
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          use_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "invite_codes_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notices: {
        Row: {
          body: string
          community_id: string
          created_at: string
          created_by: string
          id: string
          pinned: boolean
          title: string
          updated_at: string
        }
        Insert: {
          body?: string
          community_id: string
          created_at?: string
          created_by: string
          id?: string
          pinned?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          community_id?: string
          created_at?: string
          created_by?: string
          id?: string
          pinned?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notices_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          community_id: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["notification_kind"]
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string
          community_id?: string | null
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["notification_kind"]
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          community_id?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          handle: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          handle: string
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          handle?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      relationship_pairs: {
        Row: {
          community_id: string
          created_at: string
          created_by: string
          first_member_id: string
          id: string
          label: string
          second_member_id: string
          updated_at: string
        }
        Insert: {
          community_id: string
          created_at?: string
          created_by: string
          first_member_id: string
          id?: string
          label?: string
          second_member_id: string
          updated_at?: string
        }
        Update: {
          community_id?: string
          created_at?: string
          created_by?: string
          first_member_id?: string
          id?: string
          label?: string
          second_member_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "relationship_pairs_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationship_pairs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationship_pairs_first_member_id_fkey"
            columns: ["first_member_id"]
            isOneToOne: false
            referencedRelation: "community_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationship_pairs_second_member_id_fkey"
            columns: ["second_member_id"]
            isOneToOne: false
            referencedRelation: "community_members"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_community: {
        Args: {
          p_accent?: string
          p_description?: string
          p_invite_code?: string
          p_name: string
        }
        Returns: string
      }
      create_community_notifications: {
        Args: {
          p_body?: string
          p_community_id: string
          p_exclude_current_user?: boolean
          p_kind: Database["public"]["Enums"]["notification_kind"]
          p_title: string
        }
        Returns: number
      }
      current_community_member_id: {
        Args: { target_community_id: string }
        Returns: string
      }
      current_member_role: {
        Args: { target_community_id: string }
        Returns: Database["public"]["Enums"]["community_role"]
      }
      ensure_profile: { Args: { target_user_id: string }; Returns: undefined }
      is_community_admin: {
        Args: { target_community_id: string }
        Returns: boolean
      }
      is_community_member: {
        Args: { target_community_id: string }
        Returns: boolean
      }
      join_community_with_invite_code: {
        Args: { p_code: string }
        Returns: string
      }
      leave_community: { Args: { p_community_id: string }; Returns: undefined }
      make_invite_code: { Args: { seed_text: string }; Returns: string }
      regenerate_invite_code: {
        Args: { p_community_id: string }
        Returns: string
      }
      remove_community_member: {
        Args: { p_community_id: string; p_member_id: string }
        Returns: undefined
      }
      shares_community_with_user: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      update_community_member_role: {
        Args: {
          p_community_id: string
          p_member_id: string
          p_role: Database["public"]["Enums"]["community_role"]
        }
        Returns: {
          community_id: string
          id: string
          joined_at: string
          role: Database["public"]["Enums"]["community_role"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "community_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      album_item_kind: "photo" | "video" | "note"
      community_role: "owner" | "admin" | "member"
      dday_kind: "anniversary" | "trip" | "birthday" | "event"
      notification_kind:
        | "invite"
        | "calendar"
        | "album"
        | "dday"
        | "notice"
        | "commitment"
        | "message"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      album_item_kind: ["photo", "video", "note"],
      community_role: ["owner", "admin", "member"],
      dday_kind: ["anniversary", "trip", "birthday", "event"],
      notification_kind: [
        "invite",
        "calendar",
        "album",
        "dday",
        "notice",
        "commitment",
        "message",
      ],
    },
  },
} as const
