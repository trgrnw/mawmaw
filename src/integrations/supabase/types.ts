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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_logs: {
        Row: {
          action: string
          admin_user_id: string | null
          created_at: string
          details: Json | null
          id: string
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_user_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      announcements: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          message: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          message: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          message?: string
          title?: string
        }
        Relationships: []
      }
      casino_bets: {
        Row: {
          auto_cashout: number | null
          bet_amount: number
          bomb_count: number | null
          cashout_multiplier: number | null
          choice: string | null
          created_at: string
          game_type: string
          id: string
          profit: number | null
          result: string
          round_id: string | null
          user_id: string
          username: string
        }
        Insert: {
          auto_cashout?: number | null
          bet_amount: number
          bomb_count?: number | null
          cashout_multiplier?: number | null
          choice?: string | null
          created_at?: string
          game_type: string
          id?: string
          profit?: number | null
          result?: string
          round_id?: string | null
          user_id: string
          username?: string
        }
        Update: {
          auto_cashout?: number | null
          bet_amount?: number
          bomb_count?: number | null
          cashout_multiplier?: number | null
          choice?: string | null
          created_at?: string
          game_type?: string
          id?: string
          profit?: number | null
          result?: string
          round_id?: string | null
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      casino_coinflip_rounds: {
        Row: {
          created_at: string
          id: string
          result: string | null
          started_at: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          result?: string | null
          started_at: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          result?: string | null
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      casino_mines_games: {
        Row: {
          bet_amount: number
          bomb_count: number
          bomb_positions: number[]
          created_at: string
          current_multiplier: number
          id: string
          revealed_positions: number[]
          status: string
          user_id: string
        }
        Insert: {
          bet_amount: number
          bomb_count: number
          bomb_positions: number[]
          created_at?: string
          current_multiplier?: number
          id?: string
          revealed_positions?: number[]
          status?: string
          user_id: string
        }
        Update: {
          bet_amount?: number
          bomb_count?: number
          bomb_positions?: number[]
          created_at?: string
          current_multiplier?: number
          id?: string
          revealed_positions?: number[]
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      casino_rocket_rounds: {
        Row: {
          crash_point: number
          created_at: string
          id: string
          started_at: string
          status: string
        }
        Insert: {
          crash_point: number
          created_at?: string
          id?: string
          started_at: string
          status?: string
        }
        Update: {
          crash_point?: number
          created_at?: string
          id?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      clan_chat_messages: {
        Row: {
          clan_id: string
          created_at: string
          id: string
          message: string
          user_id: string
          username: string
        }
        Insert: {
          clan_id: string
          created_at?: string
          id?: string
          message: string
          user_id: string
          username?: string
        }
        Update: {
          clan_id?: string
          created_at?: string
          id?: string
          message?: string
          user_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "clan_chat_messages_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clan_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clan_chat_messages_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
        ]
      }
      clan_invites: {
        Row: {
          clan_id: string
          created_at: string
          id: string
          invitee_id: string
          inviter_id: string
          responded_at: string | null
          status: string
        }
        Insert: {
          clan_id: string
          created_at?: string
          id?: string
          invitee_id: string
          inviter_id: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          clan_id?: string
          created_at?: string
          id?: string
          invitee_id?: string
          inviter_id?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "clan_invites_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clan_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clan_invites_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
        ]
      }
      clan_members: {
        Row: {
          clan_id: string
          id: string
          joined_at: string
          role_id: string
          user_id: string
        }
        Insert: {
          clan_id: string
          id?: string
          joined_at?: string
          role_id: string
          user_id: string
        }
        Update: {
          clan_id?: string
          id?: string
          joined_at?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clan_members_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clan_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clan_members_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clan_members_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "clan_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      clan_roles: {
        Row: {
          clan_id: string
          color: string
          created_at: string
          id: string
          is_owner_role: boolean
          name: string
          perm_edit_clan: boolean
          perm_invite: boolean
          perm_kick: boolean
          perm_manage_roles: boolean
          perm_treasury: boolean
          rank: number
        }
        Insert: {
          clan_id: string
          color?: string
          created_at?: string
          id?: string
          is_owner_role?: boolean
          name: string
          perm_edit_clan?: boolean
          perm_invite?: boolean
          perm_kick?: boolean
          perm_manage_roles?: boolean
          perm_treasury?: boolean
          rank?: number
        }
        Update: {
          clan_id?: string
          color?: string
          created_at?: string
          id?: string
          is_owner_role?: boolean
          name?: string
          perm_edit_clan?: boolean
          perm_invite?: boolean
          perm_kick?: boolean
          perm_manage_roles?: boolean
          perm_treasury?: boolean
          rank?: number
        }
        Relationships: [
          {
            foreignKeyName: "clan_roles_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clan_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clan_roles_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
        ]
      }
      clan_treasury_logs: {
        Row: {
          action: string
          amount: number
          clan_id: string
          created_at: string
          id: string
          user_id: string
          username: string
        }
        Insert: {
          action: string
          amount: number
          clan_id: string
          created_at?: string
          id?: string
          user_id: string
          username?: string
        }
        Update: {
          action?: string
          amount?: number
          clan_id?: string
          created_at?: string
          id?: string
          user_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "clan_treasury_logs_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clan_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clan_treasury_logs_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
        ]
      }
      clans: {
        Row: {
          created_at: string
          description: string | null
          emoji: string
          id: string
          member_count: number
          name: string
          owner_id: string
          tag: string
          total_net_worth: number
          treasury: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          emoji?: string
          id?: string
          member_count?: number
          name: string
          owner_id: string
          tag: string
          total_net_worth?: number
          treasury?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          emoji?: string
          id?: string
          member_count?: number
          name?: string
          owner_id?: string
          tag?: string
          total_net_worth?: number
          treasury?: number
          updated_at?: string
        }
        Relationships: []
      }
      daily_wheel_spins: {
        Row: {
          created_at: string
          id: string
          prize_amount: number
          prize_label: string
          prize_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          prize_amount?: number
          prize_label: string
          prize_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          prize_amount?: number
          prize_label?: string
          prize_type?: string
          user_id?: string
        }
        Relationships: []
      }
      game_saves: {
        Row: {
          game_state: Json
          id: string
          last_seen_at: string
          net_worth: number
          pending_balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          game_state?: Json
          id?: string
          last_seen_at?: string
          net_worth?: number
          pending_balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          game_state?: Json
          id?: string
          last_seen_at?: string
          net_worth?: number
          pending_balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      market_bids: {
        Row: {
          amount: number
          bidder_id: string
          bidder_name: string
          created_at: string
          id: string
          listing_id: string
        }
        Insert: {
          amount: number
          bidder_id: string
          bidder_name?: string
          created_at?: string
          id?: string
          listing_id: string
        }
        Update: {
          amount?: number
          bidder_id?: string
          bidder_name?: string
          created_at?: string
          id?: string
          listing_id?: string
        }
        Relationships: []
      }
      market_favorites: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          user_id?: string
        }
        Relationships: []
      }
      market_listings: {
        Row: {
          auction_ends_at: string | null
          bid_count: number
          buyer_id: string | null
          created_at: string
          current_bid: number | null
          current_bidder_id: string | null
          id: string
          item_data: Json
          item_type: string
          listing_kind: string
          min_bid: number | null
          price: number
          seller_id: string
          sold_at: string | null
          status: string
        }
        Insert: {
          auction_ends_at?: string | null
          bid_count?: number
          buyer_id?: string | null
          created_at?: string
          current_bid?: number | null
          current_bidder_id?: string | null
          id?: string
          item_data?: Json
          item_type: string
          listing_kind?: string
          min_bid?: number | null
          price: number
          seller_id: string
          sold_at?: string | null
          status?: string
        }
        Update: {
          auction_ends_at?: string | null
          bid_count?: number
          buyer_id?: string | null
          created_at?: string
          current_bid?: number | null
          current_bidder_id?: string | null
          id?: string
          item_data?: Json
          item_type?: string
          listing_kind?: string
          min_bid?: number | null
          price?: number
          seller_id?: string
          sold_at?: string | null
          status?: string
        }
        Relationships: []
      }
      net_worth_history: {
        Row: {
          id: string
          net_worth: number
          recorded_at: string
          user_id: string
        }
        Insert: {
          id?: string
          net_worth?: number
          recorded_at?: string
          user_id: string
        }
        Update: {
          id?: string
          net_worth?: number
          recorded_at?: string
          user_id?: string
        }
        Relationships: []
      }
      player_reports: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          reported_user_id: string
          reporter_user_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          staff_note: string | null
          status: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string
          id?: string
          reported_user_id: string
          reporter_user_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          staff_note?: string | null
          status?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          reported_user_id?: string
          reporter_user_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          staff_note?: string | null
          status?: string
        }
        Relationships: []
      }
      player_usernames: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          user_id: string
          username: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          user_id: string
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      profile_likes: {
        Row: {
          created_at: string
          id: string
          liker_user_id: string
          profile_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          liker_user_id: string
          profile_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          liker_user_id?: string
          profile_user_id?: string
        }
        Relationships: []
      }
      profile_reviews: {
        Row: {
          author_user_id: string
          author_username: string
          created_at: string
          id: string
          profile_user_id: string
          rating: number
          text: string
          updated_at: string
        }
        Insert: {
          author_user_id: string
          author_username?: string
          created_at?: string
          id?: string
          profile_user_id: string
          rating: number
          text: string
          updated_at?: string
        }
        Update: {
          author_user_id?: string
          author_username?: string
          created_at?: string
          id?: string
          profile_user_id?: string
          rating?: number
          text?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_emoji: string
          avatar_url: string | null
          banner_url: string | null
          created_at: string
          frame_id: string | null
          id: string
          player_id: number
          showcase_items: Json
          status_text: string | null
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          avatar_emoji?: string
          avatar_url?: string | null
          banner_url?: string | null
          created_at?: string
          frame_id?: string | null
          id?: string
          player_id?: number
          showcase_items?: Json
          status_text?: string | null
          updated_at?: string
          user_id: string
          username?: string
        }
        Update: {
          avatar_emoji?: string
          avatar_url?: string | null
          banner_url?: string | null
          created_at?: string
          frame_id?: string | null
          id?: string
          player_id?: number
          showcase_items?: Json
          status_text?: string | null
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          category: string
          closed_at: string | null
          closed_by: string | null
          created_at: string
          id: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          id?: string
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          id?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ticket_messages: {
        Row: {
          author_user_id: string
          author_username: string
          created_at: string
          id: string
          is_staff_reply: boolean
          message: string
          ticket_id: string
        }
        Insert: {
          author_user_id: string
          author_username?: string
          created_at?: string
          id?: string
          is_staff_reply?: boolean
          message: string
          ticket_id: string
        }
        Update: {
          author_user_id?: string
          author_username?: string
          created_at?: string
          id?: string
          is_staff_reply?: boolean
          message?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_bans: {
        Row: {
          ban_type: string
          banned_by: string | null
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          reason: string
          unbanned_at: string | null
          unbanned_by: string | null
          user_id: string
        }
        Insert: {
          ban_type?: string
          banned_by?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          reason?: string
          unbanned_at?: string | null
          unbanned_by?: string | null
          user_id: string
        }
        Update: {
          ban_type?: string
          banned_by?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          reason?: string
          unbanned_at?: string | null
          unbanned_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      clan_leaderboard: {
        Row: {
          created_at: string | null
          description: string | null
          emoji: string | null
          id: string | null
          member_count: number | null
          name: string | null
          owner_id: string | null
          owner_name: string | null
          tag: string | null
          total_net_worth: number | null
          treasury: number | null
        }
        Relationships: []
      }
      forbes_leaderboard: {
        Row: {
          avatar_emoji: string | null
          net_worth: number | null
          player_id: number | null
          updated_at: string | null
          username: string | null
        }
        Relationships: []
      }
      public_player_stats: {
        Row: {
          avatar_emoji: string | null
          avatar_url: string | null
          avg_rating: number | null
          banner_url: string | null
          frame_id: string | null
          joined_at: string | null
          last_seen_at: string | null
          likes_count: number | null
          net_worth: number | null
          player_id: number | null
          reviews_count: number | null
          showcase_items: Json | null
          status_text: string | null
          user_id: string | null
          username: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_adjust_balance: {
        Args: { p_delta: number; p_reason: string; p_user_id: string }
        Returns: Json
      }
      assign_clan_role: {
        Args: { p_role_id: string; p_user_id: string }
        Returns: Json
      }
      ban_user: {
        Args: { p_duration_hours: number; p_reason: string; p_user_id: string }
        Returns: Json
      }
      buy_market_listing: { Args: { p_listing_id: string }; Returns: Json }
      cancel_auction: { Args: { p_listing_id: string }; Returns: Json }
      claim_offline_income: { Args: { p_hourly_income: number }; Returns: Json }
      claim_pending_balance: { Args: never; Returns: Json }
      clan_treasury_op: {
        Args: { p_action: string; p_amount: number }
        Returns: Json
      }
      close_ticket: { Args: { p_ticket_id: string }; Returns: Json }
      create_auction_listing: {
        Args: {
          p_duration_hours: number
          p_item_data: Json
          p_item_type: string
          p_min_bid: number
        }
        Returns: Json
      }
      create_clan: {
        Args: {
          p_description: string
          p_emoji: string
          p_name: string
          p_tag: string
        }
        Returns: Json
      }
      create_clan_role: {
        Args: {
          p_color: string
          p_edit_clan: boolean
          p_invite: boolean
          p_kick: boolean
          p_manage_roles: boolean
          p_name: string
          p_treasury: boolean
        }
        Returns: Json
      }
      create_support_ticket: {
        Args: { p_category: string; p_message: string; p_subject: string }
        Returns: Json
      }
      delete_clan: { Args: never; Returns: Json }
      delete_clan_role: { Args: { p_role_id: string }; Returns: Json }
      delete_profile_review: { Args: { p_review_id: string }; Returns: Json }
      finalize_expired_auctions: { Args: never; Returns: Json }
      get_active_ban: {
        Args: { _user_id: string }
        Returns: {
          ban_type: string
          created_at: string
          expires_at: string
          id: string
          reason: string
        }[]
      }
      get_player_public_profile: {
        Args: { p_profile_user_id: string }
        Returns: Json
      }
      get_user_clan_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      heartbeat_presence: { Args: never; Returns: undefined }
      invite_to_clan: { Args: { p_invitee_id: string }; Returns: Json }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      is_user_banned: { Args: { _user_id: string }; Returns: boolean }
      kick_clan_member: { Args: { p_user_id: string }; Returns: Json }
      leave_clan: { Args: never; Returns: Json }
      place_bid: {
        Args: { p_amount: number; p_listing_id: string }
        Returns: Json
      }
      post_profile_review: {
        Args: { p_profile_user_id: string; p_rating: number; p_text: string }
        Returns: Json
      }
      post_ticket_message: {
        Args: { p_message: string; p_ticket_id: string }
        Returns: Json
      }
      reopen_ticket: { Args: { p_ticket_id: string }; Returns: Json }
      respond_clan_invite: {
        Args: { p_accept: boolean; p_invite_id: string }
        Returns: Json
      }
      send_clan_message: { Args: { p_message: string }; Returns: Json }
      spin_daily_wheel: { Args: never; Returns: Json }
      submit_player_report: {
        Args: {
          p_category: string
          p_description: string
          p_reported_user_id: string
        }
        Returns: Json
      }
      toggle_profile_like: {
        Args: { p_profile_user_id: string }
        Returns: Json
      }
      unban_user: { Args: { p_user_id: string }; Returns: Json }
      update_clan_info: {
        Args: {
          p_description: string
          p_emoji: string
          p_name: string
          p_tag: string
        }
        Returns: Json
      }
      update_clan_role: {
        Args: {
          p_color: string
          p_edit_clan: boolean
          p_invite: boolean
          p_kick: boolean
          p_manage_roles: boolean
          p_name: string
          p_role_id: string
          p_treasury: boolean
        }
        Returns: Json
      }
      update_profile_customization: {
        Args: { p_banner: string; p_frame: string; p_status: string }
        Returns: Json
      }
      update_profile_extras: {
        Args: { p_avatar_url: string; p_showcase: Json }
        Returns: Json
      }
      update_report_status: {
        Args: { p_note: string; p_report_id: string; p_status: string }
        Returns: Json
      }
      user_has_clan_perm: {
        Args: { _clan_id: string; _perm: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "moderator"
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
      app_role: ["owner", "admin", "moderator"],
    },
  },
} as const
