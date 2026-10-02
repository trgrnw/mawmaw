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
          id: string
          admin_user_id: string | null
          action: string
          target_user_id: string | null
          details: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          admin_user_id?: string | null
          action: string
          target_user_id?: string | null
          details?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          admin_user_id?: string | null
          action?: string
          target_user_id?: string | null
          details?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          id: string
          title: string
          message: string
          is_active: boolean
          created_by: string | null
          created_at: string
          expires_at: string | null
        }
        Insert: {
          id?: string
          title: string
          message: string
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          expires_at?: string | null
        }
        Update: {
          id?: string
          title?: string
          message?: string
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          expires_at?: string | null
        }
        Relationships: []
      }
      casino_bets: {
        Row: {
          id: string
          user_id: string
          username: string
          game_type: string
          round_id: string | null
          bet_amount: number
          auto_cashout: number | null
          cashout_multiplier: number | null
          profit: number | null
          result: string
          choice: string | null
          bomb_count: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          username?: string
          game_type: string
          round_id?: string | null
          bet_amount: number
          auto_cashout?: number | null
          cashout_multiplier?: number | null
          profit?: number | null
          result?: string
          choice?: string | null
          bomb_count?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          username?: string
          game_type?: string
          round_id?: string | null
          bet_amount?: number
          auto_cashout?: number | null
          cashout_multiplier?: number | null
          profit?: number | null
          result?: string
          choice?: string | null
          bomb_count?: number | null
          created_at?: string
        }
        Relationships: []
      }
      casino_coinflip_rounds: {
        Row: {
          id: string
          result: string | null
          status: string
          started_at: string
          created_at: string
        }
        Insert: {
          id?: string
          result?: string | null
          status?: string
          started_at: string
          created_at?: string
        }
        Update: {
          id?: string
          result?: string | null
          status?: string
          started_at?: string
          created_at?: string
        }
        Relationships: []
      }
      casino_mines_games: {
        Row: {
          id: string
          user_id: string
          bomb_positions: (number)[]
          bomb_count: number
          revealed_positions: (number)[]
          bet_amount: number
          current_multiplier: number
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          bomb_positions: (number)[]
          bomb_count: number
          revealed_positions?: (number)[]
          bet_amount: number
          current_multiplier?: number
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          bomb_positions?: (number)[]
          bomb_count?: number
          revealed_positions?: (number)[]
          bet_amount?: number
          current_multiplier?: number
          status?: string
          created_at?: string
        }
        Relationships: []
      }
      casino_requests: {
        Row: {
          user_id: string
          request_id: string
          response: Json
          created_at: string
        }
        Insert: {
          user_id: string
          request_id: string
          response: Json
          created_at?: string
        }
        Update: {
          user_id?: string
          request_id?: string
          response?: Json
          created_at?: string
        }
        Relationships: []
      }
      casino_rocket_rounds: {
        Row: {
          id: string
          crash_point: number
          status: string
          started_at: string
          created_at: string
        }
        Insert: {
          id?: string
          crash_point: number
          status?: string
          started_at: string
          created_at?: string
        }
        Update: {
          id?: string
          crash_point?: number
          status?: string
          started_at?: string
          created_at?: string
        }
        Relationships: []
      }
      clan_action_logs: {
        Row: {
          id: string
          clan_id: string
          actor_user_id: string | null
          actor_username: string
          action: string
          details: Json
          created_at: string
        }
        Insert: {
          id?: string
          clan_id: string
          actor_user_id?: string | null
          actor_username?: string
          action: string
          details?: Json
          created_at?: string
        }
        Update: {
          id?: string
          clan_id?: string
          actor_user_id?: string | null
          actor_username?: string
          action?: string
          details?: Json
          created_at?: string
        }
        Relationships: []
      }
      clan_chat_messages: {
        Row: {
          id: string
          clan_id: string
          user_id: string
          username: string
          message: string
          created_at: string
        }
        Insert: {
          id?: string
          clan_id: string
          user_id: string
          username?: string
          message: string
          created_at?: string
        }
        Update: {
          id?: string
          clan_id?: string
          user_id?: string
          username?: string
          message?: string
          created_at?: string
        }
        Relationships: []
      }
      clan_invites: {
        Row: {
          id: string
          clan_id: string
          inviter_id: string
          invitee_id: string
          status: string
          created_at: string
          responded_at: string | null
        }
        Insert: {
          id?: string
          clan_id: string
          inviter_id: string
          invitee_id: string
          status?: string
          created_at?: string
          responded_at?: string | null
        }
        Update: {
          id?: string
          clan_id?: string
          inviter_id?: string
          invitee_id?: string
          status?: string
          created_at?: string
          responded_at?: string | null
        }
        Relationships: []
      }
      clan_members: {
        Row: {
          id: string
          clan_id: string
          user_id: string
          role_id: string
          joined_at: string
        }
        Insert: {
          id?: string
          clan_id: string
          user_id: string
          role_id: string
          joined_at?: string
        }
        Update: {
          id?: string
          clan_id?: string
          user_id?: string
          role_id?: string
          joined_at?: string
        }
        Relationships: []
      }
      clan_roles: {
        Row: {
          id: string
          clan_id: string
          name: string
          color: string
          rank: number
          is_owner_role: boolean
          perm_invite: boolean
          perm_kick: boolean
          perm_treasury: boolean
          perm_edit_clan: boolean
          perm_manage_roles: boolean
          created_at: string
        }
        Insert: {
          id?: string
          clan_id: string
          name: string
          color?: string
          rank?: number
          is_owner_role?: boolean
          perm_invite?: boolean
          perm_kick?: boolean
          perm_treasury?: boolean
          perm_edit_clan?: boolean
          perm_manage_roles?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          clan_id?: string
          name?: string
          color?: string
          rank?: number
          is_owner_role?: boolean
          perm_invite?: boolean
          perm_kick?: boolean
          perm_treasury?: boolean
          perm_edit_clan?: boolean
          perm_manage_roles?: boolean
          created_at?: string
        }
        Relationships: []
      }
      clan_treasury_logs: {
        Row: {
          id: string
          clan_id: string
          user_id: string
          username: string
          action: string
          amount: number
          created_at: string
        }
        Insert: {
          id?: string
          clan_id: string
          user_id: string
          username?: string
          action: string
          amount: number
          created_at?: string
        }
        Update: {
          id?: string
          clan_id?: string
          user_id?: string
          username?: string
          action?: string
          amount?: number
          created_at?: string
        }
        Relationships: []
      }
      clans: {
        Row: {
          id: string
          name: string
          tag: string
          description: string | null
          emoji: string
          treasury: number
          owner_id: string
          total_net_worth: number
          member_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          tag: string
          description?: string | null
          emoji?: string
          treasury?: number
          owner_id: string
          total_net_worth?: number
          member_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          tag?: string
          description?: string | null
          emoji?: string
          treasury?: number
          owner_id?: string
          total_net_worth?: number
          member_count?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      daily_wheel_spins: {
        Row: {
          id: string
          user_id: string
          prize_type: string
          prize_amount: number
          prize_label: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          prize_type: string
          prize_amount?: number
          prize_label: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          prize_type?: string
          prize_amount?: number
          prize_label?: string
          created_at?: string
        }
        Relationships: []
      }
      game_action_receipts: {
        Row: {
          user_id: string
          action_id: string
          created_at: string
        }
        Insert: {
          user_id: string
          action_id: string
          created_at?: string
        }
        Update: {
          user_id?: string
          action_id?: string
          created_at?: string
        }
        Relationships: []
      }
      game_saves: {
        Row: {
          id: string
          user_id: string
          game_state: Json
          net_worth: number
          updated_at: string
          pending_balance: number
          last_seen_at: string
          revision: number
        }
        Insert: {
          id?: string
          user_id: string
          game_state?: Json
          net_worth?: number
          updated_at?: string
          pending_balance?: number
          last_seen_at?: string
          revision?: number
        }
        Update: {
          id?: string
          user_id?: string
          game_state?: Json
          net_worth?: number
          updated_at?: string
          pending_balance?: number
          last_seen_at?: string
          revision?: number
        }
        Relationships: []
      }
      market_bids: {
        Row: {
          id: string
          listing_id: string
          bidder_id: string
          bidder_name: string
          amount: number
          created_at: string
        }
        Insert: {
          id?: string
          listing_id: string
          bidder_id: string
          bidder_name?: string
          amount: number
          created_at?: string
        }
        Update: {
          id?: string
          listing_id?: string
          bidder_id?: string
          bidder_name?: string
          amount?: number
          created_at?: string
        }
        Relationships: []
      }
      market_favorites: {
        Row: {
          id: string
          user_id: string
          listing_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          listing_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          listing_id?: string
          created_at?: string
        }
        Relationships: []
      }
      market_listings: {
        Row: {
          id: string
          seller_id: string
          item_type: string
          item_data: Json
          price: number
          status: string
          buyer_id: string | null
          created_at: string
          sold_at: string | null
          listing_kind: string
          auction_ends_at: string | null
          min_bid: number | null
          current_bid: number | null
          current_bidder_id: string | null
          bid_count: number
        }
        Insert: {
          id?: string
          seller_id: string
          item_type: string
          item_data?: Json
          price: number
          status?: string
          buyer_id?: string | null
          created_at?: string
          sold_at?: string | null
          listing_kind?: string
          auction_ends_at?: string | null
          min_bid?: number | null
          current_bid?: number | null
          current_bidder_id?: string | null
          bid_count?: number
        }
        Update: {
          id?: string
          seller_id?: string
          item_type?: string
          item_data?: Json
          price?: number
          status?: string
          buyer_id?: string | null
          created_at?: string
          sold_at?: string | null
          listing_kind?: string
          auction_ends_at?: string | null
          min_bid?: number | null
          current_bid?: number | null
          current_bidder_id?: string | null
          bid_count?: number
        }
        Relationships: []
      }
      net_worth_history: {
        Row: {
          id: string
          user_id: string
          net_worth: number
          recorded_at: string
        }
        Insert: {
          id?: string
          user_id: string
          net_worth?: number
          recorded_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          net_worth?: number
          recorded_at?: string
        }
        Relationships: []
      }
      owned_license_plates: {
        Row: {
          id: string
          owner_id: string
          data: Json
          listing_id: string | null
        }
        Insert: {
          id: string
          owner_id: string
          data: Json
          listing_id?: string | null
        }
        Update: {
          id?: string
          owner_id?: string
          data?: Json
          listing_id?: string | null
        }
        Relationships: []
      }
      player_reports: {
        Row: {
          id: string
          reporter_user_id: string
          reported_user_id: string
          category: string
          description: string
          status: string
          reviewed_by: string | null
          reviewed_at: string | null
          staff_note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          reporter_user_id: string
          reported_user_id: string
          category: string
          description?: string
          status?: string
          reviewed_by?: string | null
          reviewed_at?: string | null
          staff_note?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          reporter_user_id?: string
          reported_user_id?: string
          category?: string
          description?: string
          status?: string
          reviewed_by?: string | null
          reviewed_at?: string | null
          staff_note?: string | null
          created_at?: string
        }
        Relationships: []
      }
      player_usernames: {
        Row: {
          id: string
          user_id: string
          username: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          username: string
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          username?: string
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      profile_likes: {
        Row: {
          id: string
          profile_user_id: string
          liker_user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          profile_user_id: string
          liker_user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          profile_user_id?: string
          liker_user_id?: string
          created_at?: string
        }
        Relationships: []
      }
      profile_reviews: {
        Row: {
          id: string
          profile_user_id: string
          author_user_id: string
          author_username: string
          rating: number
          text: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          profile_user_id: string
          author_user_id: string
          author_username?: string
          rating: number
          text: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          profile_user_id?: string
          author_user_id?: string
          author_username?: string
          rating?: number
          text?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          user_id: string
          username: string
          avatar_emoji: string
          created_at: string
          updated_at: string
          player_id: number
          banner_url: string | null
          frame_id: string | null
          status_text: string | null
          avatar_url: string | null
          showcase_items: Json
        }
        Insert: {
          id?: string
          user_id: string
          username?: string
          avatar_emoji?: string
          created_at?: string
          updated_at?: string
          player_id?: number
          banner_url?: string | null
          frame_id?: string | null
          status_text?: string | null
          avatar_url?: string | null
          showcase_items?: Json
        }
        Update: {
          id?: string
          user_id?: string
          username?: string
          avatar_emoji?: string
          created_at?: string
          updated_at?: string
          player_id?: number
          banner_url?: string | null
          frame_id?: string | null
          status_text?: string | null
          avatar_url?: string | null
          showcase_items?: Json
        }
        Relationships: []
      }
      public_player_stats: {
        Row: {
          user_id: string | null
          player_id: number | null
          username: string | null
          avatar_emoji: string | null
          avatar_url: string | null
          banner_url: string | null
          frame_id: string | null
          status_text: string | null
          showcase_items: Json | null
          joined_at: string | null
          net_worth: number | null
          last_seen_at: string | null
          likes_count: number | null
          reviews_count: number | null
          avg_rating: number | null
        }
        Insert: {
          user_id?: string | null
          player_id?: number | null
          username?: string | null
          avatar_emoji?: string | null
          avatar_url?: string | null
          banner_url?: string | null
          frame_id?: string | null
          status_text?: string | null
          showcase_items?: Json | null
          joined_at?: string | null
          net_worth?: number | null
          last_seen_at?: string | null
          likes_count?: number | null
          reviews_count?: number | null
          avg_rating?: number | null
        }
        Update: {
          user_id?: string | null
          player_id?: number | null
          username?: string | null
          avatar_emoji?: string | null
          avatar_url?: string | null
          banner_url?: string | null
          frame_id?: string | null
          status_text?: string | null
          showcase_items?: Json | null
          joined_at?: string | null
          net_worth?: number | null
          last_seen_at?: string | null
          likes_count?: number | null
          reviews_count?: number | null
          avg_rating?: number | null
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          id: string
          user_id: string
          category: string
          subject: string
          status: string
          created_at: string
          updated_at: string
          closed_at: string | null
          closed_by: string | null
        }
        Insert: {
          id?: string
          user_id: string
          category: string
          subject: string
          status?: string
          created_at?: string
          updated_at?: string
          closed_at?: string | null
          closed_by?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          category?: string
          subject?: string
          status?: string
          created_at?: string
          updated_at?: string
          closed_at?: string | null
          closed_by?: string | null
        }
        Relationships: []
      }
      ticket_messages: {
        Row: {
          id: string
          ticket_id: string
          author_user_id: string
          author_username: string
          is_staff_reply: boolean
          message: string
          created_at: string
        }
        Insert: {
          id?: string
          ticket_id: string
          author_user_id: string
          author_username?: string
          is_staff_reply?: boolean
          message: string
          created_at?: string
        }
        Update: {
          id?: string
          ticket_id?: string
          author_user_id?: string
          author_username?: string
          is_staff_reply?: boolean
          message?: string
          created_at?: string
        }
        Relationships: []
      }
      user_bans: {
        Row: {
          id: string
          user_id: string
          banned_by: string | null
          reason: string
          ban_type: string
          expires_at: string | null
          is_active: boolean
          unbanned_by: string | null
          unbanned_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          banned_by?: string | null
          reason?: string
          ban_type?: string
          expires_at?: string | null
          is_active?: boolean
          unbanned_by?: string | null
          unbanned_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          banned_by?: string | null
          reason?: string
          ban_type?: string
          expires_at?: string | null
          is_active?: boolean
          unbanned_by?: string | null
          unbanned_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          user_id: string
          role: Database["public"]["Enums"]["app_role"]
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          role: Database["public"]["Enums"]["app_role"]
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          created_at?: string
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
      admin_set_player_balance: { Args: {p_user_id: string; p_balance: number}; Returns: Json }
      admin_reset_player: { Args: {p_user_id: string}; Returns: Json }
      admin_adjust_balance: { Args: { p_user_id: string; p_delta: number; p_reason: string }; Returns: Json }
      assign_clan_role: { Args: { p_user_id: string; p_role_id: string }; Returns: Json }
      ban_user: { Args: { p_user_id: string; p_reason: string; p_duration_hours: number }; Returns: Json }
      buy_market_listing: { Args: { p_listing_id: string }; Returns: Json }
      cancel_auction: { Args: { p_listing_id: string }; Returns: Json }
      casino_action: { Args: { p_uid: string; p_action: string; p_body: Json }; Returns: Json }
      casino_random: { Args: Record<string, never>; Returns: number }
      change_profile_nickname: { Args: { p_nickname: string }; Returns: string }
      claim_offline_income: { Args: { p_hourly_income: number }; Returns: Json }
      claim_pending_balance: { Args: Record<string, never>; Returns: Json }
      clan_treasury_op: { Args: { p_action: string; p_amount: number }; Returns: Json }
      close_ticket: { Args: { p_ticket_id: string }; Returns: Json }
      commit_verified_game_state: { Args: { p_user_id: string; p_revision: number; p_state: Json; p_net_worth: number; p_action_ids: (string)[] }; Returns: Json }
      create_auction_listing: { Args: { p_item_type: string; p_item_data: Json; p_min_bid: number; p_duration_hours: number }; Returns: Json }
      create_clan: { Args: { p_name: string; p_tag: string; p_emoji: string; p_description: string }; Returns: Json }
      create_clan_role: { Args: { p_name: string; p_color: string; p_invite: boolean; p_kick: boolean; p_treasury: boolean; p_edit_clan: boolean; p_manage_roles: boolean }; Returns: Json }
      create_market_listing: { Args: { p_item_type: string; p_item_data: Json; p_price: number; p_duration_hours?: number }; Returns: Json }
      create_support_ticket: { Args: { p_category: string; p_subject: string; p_message: string }; Returns: Json }
      debit_player: { Args: { p_uid: string; p_amount: number }; Returns: undefined }
      delete_clan: { Args: Record<string, never>; Returns: Json }
      delete_clan_confirmed: { Args: { p_clan_name: string }; Returns: Json }
      delete_clan_role: { Args: { p_role_id: string }; Returns: Json }
      delete_player_username: { Args: { p_id: string }; Returns: Json }
      delete_profile_review: { Args: { p_review_id: string }; Returns: Json }
      finalize_expired_auctions: { Args: Record<string, never>; Returns: Json }
      get_active_ban: { Args: { _user_id: string }; Returns: { id: string; reason: string; ban_type: string; expires_at: string; created_at: string }[] }
      get_clan_leaderboard: { Args: Record<string, never>; Returns: { id: string; name: string; tag: string; emoji: string; member_count: number; total_net_worth: number; owner_name: string }[] }
      get_forbes_players: { Args: Record<string, never>; Returns: { user_id: string; username: string; avatar_emoji: string; player_id: number; net_worth: number; updated_at: string; rank: number }[] }
      get_player_public_profile: { Args: { p_profile_user_id: string }; Returns: Json }
      get_user_clan_id: { Args: { _user_id: string }; Returns: string }
      has_role: { Args: { _user_id: string; _role: Database["public"]["Enums"]["app_role"] }; Returns: boolean }
      heartbeat_presence: { Args: Record<string, never>; Returns: undefined }
      invite_to_clan: { Args: { p_invitee_id: string }; Returns: Json }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      is_user_banned: { Args: { _user_id: string }; Returns: boolean }
      kick_clan_member: { Args: { p_user_id: string }; Returns: Json }
      leave_clan: { Args: Record<string, never>; Returns: Json }
      place_bid: { Args: { p_listing_id: string; p_amount: number }; Returns: Json }
      post_profile_review: { Args: { p_profile_user_id: string; p_rating: number; p_text: string }; Returns: Json }
      post_ticket_message: { Args: { p_ticket_id: string; p_message: string }; Returns: Json }
      purchase_player_username: { Args: { p_username: string }; Returns: Json }
      reopen_ticket: { Args: { p_ticket_id: string }; Returns: Json }
      respond_clan_invite: { Args: { p_invite_id: string; p_accept: boolean }; Returns: Json }
      save_game_state: { Args: { p_state: Json; p_net_worth: number }; Returns: Json }
      search_public_players: { Args: { p_query: string }; Returns: { user_id: string; username: string; avatar_emoji: string; avatar_url: string; player_id: number; net_worth: number; likes_count: number; avg_rating: number }[] }
      send_clan_message: { Args: { p_message: string }; Returns: Json }
      settle_casino: { Args: Record<string, never>; Returns: undefined }
      spin_daily_wheel: { Args: Record<string, never>; Returns: Json }
      spin_daily_wheel_internal: { Args: Record<string, never>; Returns: Json }
      submit_player_report: { Args: { p_reported_user_id: string; p_category: string; p_description: string }; Returns: Json }
      toggle_profile_like: { Args: { p_profile_user_id: string }; Returns: Json }
      transfer_market_asset: { Args: { p_listing_id: string; p_buyer: string }; Returns: undefined }
      unban_user: { Args: { p_user_id: string }; Returns: Json }
      update_clan_info: { Args: { p_name: string; p_tag: string; p_emoji: string; p_description: string }; Returns: Json }
      update_clan_role: { Args: { p_role_id: string; p_name: string; p_color: string; p_invite: boolean; p_kick: boolean; p_treasury: boolean; p_edit_clan: boolean; p_manage_roles: boolean }; Returns: Json }
      update_profile_customization: { Args: { p_banner: string; p_frame: string; p_status: string }; Returns: Json }
      update_profile_extras: { Args: { p_avatar_url: string; p_showcase: Json }; Returns: Json }
      update_report_status: { Args: { p_report_id: string; p_status: string; p_note: string }; Returns: Json }
      user_has_clan_perm: { Args: { _user_id: string; _clan_id: string; _perm: string }; Returns: boolean }
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
