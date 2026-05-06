--
-- PostgreSQL database dump
--

-- Dumped from database version 17.5
-- Dumped by pg_dump version 17.5

-- Started on 2026-04-13 11:19:55

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 6 (class 2615 OID 2200)
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO postgres;

--
-- TOC entry 5089 (class 0 OID 0)
-- Dependencies: 6
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA public IS '';


--
-- TOC entry 2 (class 3079 OID 84696)
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- TOC entry 5091 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- TOC entry 905 (class 1247 OID 84734)
-- Name: user_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.user_role AS ENUM (
    'ADMIN',
    'PROFESOR',
    'ESTUDIANTE'
);


ALTER TYPE public.user_role OWNER TO postgres;

--
-- TOC entry 275 (class 1255 OID 84741)
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.set_updated_at() OWNER TO postgres;

--
-- TOC entry 276 (class 1255 OID 84742)
-- Name: uploads_set_timestamp(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.uploads_set_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      NEW.updated_at := NOW();
      RETURN NEW;
    END;
    $$;


ALTER FUNCTION public.uploads_set_timestamp() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 218 (class 1259 OID 84743)
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id text NOT NULL,
    user_id text,
    tenant_id text,
    action text NOT NULL,
    resource_type text,
    resource_id text,
    details text,
    ip_address text,
    user_agent text,
    created_at bigint NOT NULL
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- TOC entry 219 (class 1259 OID 84748)
-- Name: comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    upload_id text NOT NULL,
    user_id uuid NOT NULL,
    author_name text,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT comments_content_check CHECK (((length(content) >= 1) AND (length(content) <= 1000)))
);


ALTER TABLE public.comments OWNER TO postgres;

--
-- TOC entry 220 (class 1259 OID 84756)
-- Name: documentos_texto; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.documentos_texto (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    upload_id uuid NOT NULL,
    tipo text NOT NULL,
    texto text,
    video_id text,
    file_name text,
    texto_extraido text,
    creado_en timestamp without time zone DEFAULT now(),
    num_paginas integer,
    num_lineas integer,
    num_palabras integer,
    num_frases integer,
    resumen text,
    posiciones jsonb
);


ALTER TABLE public.documentos_texto OWNER TO postgres;

--
-- TOC entry 221 (class 1259 OID 84763)
-- Name: ficha_tecnica; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ficha_tecnica (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    upload_id text NOT NULL,
    titulo text,
    director text,
    productor text,
    jefe_produccion text,
    director_fotografia text,
    sonido text,
    direccion_arte text,
    asistente_direccion text,
    montaje text,
    otro_cargo text,
    contacto_principal text,
    correo text,
    curso text,
    profesor text,
    anio integer,
    duracion text,
    sinopsis text,
    proceso_anterior text,
    pendientes text,
    visto boolean,
    reunion timestamp with time zone,
    formato text,
    estado text,
    delivery_estimado text,
    seleccion text,
    link text,
    foto text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    marca text,
    agencia text,
    productora_ficha text,
    contacto text,
    oficina text,
    tipo text[] DEFAULT '{}'::text[],
    estudio text,
    produccion text,
    corporativo text,
    nuevos_negocios text,
    productora text
);


ALTER TABLE public.ficha_tecnica OWNER TO postgres;

--
-- TOC entry 222 (class 1259 OID 84771)
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    generacion text,
    facultad text,
    descripcion text,
    avatar_url text,
    instagram text,
    facebook text,
    whatsapp text,
    participaciones jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.profiles OWNER TO postgres;

--
-- TOC entry 223 (class 1259 OID 84780)
-- Name: scene_segments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.scene_segments (
    id integer NOT NULL,
    video_id text,
    scene_index integer,
    start_time numeric,
    end_time numeric
);


ALTER TABLE public.scene_segments OWNER TO postgres;

--
-- TOC entry 224 (class 1259 OID 84785)
-- Name: scene_segments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.scene_segments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.scene_segments_id_seq OWNER TO postgres;

--
-- TOC entry 5092 (class 0 OID 0)
-- Dependencies: 224
-- Name: scene_segments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.scene_segments_id_seq OWNED BY public.scene_segments.id;


--
-- TOC entry 225 (class 1259 OID 84786)
-- Name: transcriptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transcriptions (
    id integer NOT NULL,
    video_id text,
    start_time numeric,
    end_time numeric,
    text text
);


ALTER TABLE public.transcriptions OWNER TO postgres;

--
-- TOC entry 226 (class 1259 OID 84791)
-- Name: transcriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.transcriptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.transcriptions_id_seq OWNER TO postgres;

--
-- TOC entry 5093 (class 0 OID 0)
-- Dependencies: 226
-- Name: transcriptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.transcriptions_id_seq OWNED BY public.transcriptions.id;


--
-- TOC entry 227 (class 1259 OID 84792)
-- Name: uploads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.uploads (
    id text NOT NULL,
    custom_id text,
    file_key text,
    file_name text,
    size_in_bytes bigint,
    status text,
    uploaded_at timestamp without time zone,
    signed_url text,
    file_path text,
    tipo text,
    is_deleted boolean DEFAULT false,
    deleted_at timestamp with time zone,
    category text DEFAULT 'otros'::text NOT NULL,
    views integer DEFAULT 0,
    subcategory text,
    vimeo_id text,
    duration_sec integer,
    thumbnail_url text,
    created_by_id text,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT uploads_category_check CHECK ((category = ANY (ARRAY['publicidad'::text, 'entretenimiento'::text, 'vxf'::text])))
);


ALTER TABLE public.uploads OWNER TO postgres;

--
-- TOC entry 228 (class 1259 OID 84802)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    role public.user_role DEFAULT 'ESTUDIANTE'::public.user_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 229 (class 1259 OID 84811)
-- Name: v_profiles; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_profiles AS
 SELECT u.id AS user_id,
    u.name,
    u.email,
    u.role,
    p.id AS profile_id,
    p.generacion,
    p.facultad,
    p.descripcion,
    p.avatar_url,
    p.instagram,
    p.facebook,
    p.whatsapp,
    p.participaciones,
    GREATEST(u.created_at, COALESCE(p.updated_at, u.created_at)) AS updated_at
   FROM (public.users u
     LEFT JOIN public.profiles p ON ((p.user_id = u.id)));


ALTER VIEW public.v_profiles OWNER TO postgres;

--
-- TOC entry 230 (class 1259 OID 84816)
-- Name: video_frames; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.video_frames (
    id integer NOT NULL,
    video_id uuid NOT NULL,
    frame_number integer,
    time_sec numeric,
    image_data bytea,
    mime_type text DEFAULT 'image/jpeg'::text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.video_frames OWNER TO postgres;

--
-- TOC entry 231 (class 1259 OID 84823)
-- Name: video_frames_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.video_frames_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.video_frames_id_seq OWNER TO postgres;

--
-- TOC entry 5094 (class 0 OID 0)
-- Dependencies: 231
-- Name: video_frames_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.video_frames_id_seq OWNED BY public.video_frames.id;


--
-- TOC entry 232 (class 1259 OID 84824)
-- Name: video_objects; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.video_objects (
    id integer NOT NULL,
    video_id uuid NOT NULL,
    frame integer,
    time_sec numeric,
    objects text[],
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.video_objects OWNER TO postgres;

--
-- TOC entry 233 (class 1259 OID 84830)
-- Name: video_objects_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.video_objects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.video_objects_id_seq OWNER TO postgres;

--
-- TOC entry 5095 (class 0 OID 0)
-- Dependencies: 233
-- Name: video_objects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.video_objects_id_seq OWNED BY public.video_objects.id;


--
-- TOC entry 234 (class 1259 OID 84831)
-- Name: video_poses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.video_poses (
    id integer NOT NULL,
    video_id uuid,
    frame integer,
    rostro_detectado boolean,
    mano_izq_arriba boolean,
    time_sec real,
    l_shoulder_x real,
    l_shoulder_y real,
    l_shoulder_z real,
    l_wrist_x real,
    l_wrist_y real,
    l_wrist_z real,
    frame_path text
);


ALTER TABLE public.video_poses OWNER TO postgres;

--
-- TOC entry 235 (class 1259 OID 84836)
-- Name: video_poses_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.video_poses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.video_poses_id_seq OWNER TO postgres;

--
-- TOC entry 5096 (class 0 OID 0)
-- Dependencies: 235
-- Name: video_poses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.video_poses_id_seq OWNED BY public.video_poses.id;


--
-- TOC entry 236 (class 1259 OID 84837)
-- Name: video_reels; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.video_reels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    video_id text,
    duracion integer,
    archivo bytea,
    created_at timestamp without time zone DEFAULT now(),
    path text
);


ALTER TABLE public.video_reels OWNER TO postgres;

--
-- TOC entry 237 (class 1259 OID 84844)
-- Name: video_subtitulos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.video_subtitulos (
    id integer NOT NULL,
    video_id text,
    time_start real,
    time_end real,
    text text
);


ALTER TABLE public.video_subtitulos OWNER TO postgres;

--
-- TOC entry 238 (class 1259 OID 84849)
-- Name: video_subtitulos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.video_subtitulos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.video_subtitulos_id_seq OWNER TO postgres;

--
-- TOC entry 5097 (class 0 OID 0)
-- Dependencies: 238
-- Name: video_subtitulos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.video_subtitulos_id_seq OWNED BY public.video_subtitulos.id;


--
-- TOC entry 4857 (class 2604 OID 84850)
-- Name: scene_segments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scene_segments ALTER COLUMN id SET DEFAULT nextval('public.scene_segments_id_seq'::regclass);


--
-- TOC entry 4858 (class 2604 OID 84851)
-- Name: transcriptions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transcriptions ALTER COLUMN id SET DEFAULT nextval('public.transcriptions_id_seq'::regclass);


--
-- TOC entry 4867 (class 2604 OID 84852)
-- Name: video_frames id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.video_frames ALTER COLUMN id SET DEFAULT nextval('public.video_frames_id_seq'::regclass);


--
-- TOC entry 4870 (class 2604 OID 84853)
-- Name: video_objects id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.video_objects ALTER COLUMN id SET DEFAULT nextval('public.video_objects_id_seq'::regclass);


--
-- TOC entry 4872 (class 2604 OID 84854)
-- Name: video_poses id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.video_poses ALTER COLUMN id SET DEFAULT nextval('public.video_poses_id_seq'::regclass);


--
-- TOC entry 4875 (class 2604 OID 84855)
-- Name: video_subtitulos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.video_subtitulos ALTER COLUMN id SET DEFAULT nextval('public.video_subtitulos_id_seq'::regclass);


--
-- TOC entry 4879 (class 2606 OID 84878)
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 4886 (class 2606 OID 84880)
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);


--
-- TOC entry 4889 (class 2606 OID 84882)
-- Name: documentos_texto documentos_texto_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documentos_texto
    ADD CONSTRAINT documentos_texto_pkey PRIMARY KEY (id);


--
-- TOC entry 4891 (class 2606 OID 84884)
-- Name: ficha_tecnica ficha_tecnica_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ficha_tecnica
    ADD CONSTRAINT ficha_tecnica_pkey PRIMARY KEY (id);


--
-- TOC entry 4893 (class 2606 OID 84886)
-- Name: ficha_tecnica ficha_tecnica_upload_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ficha_tecnica
    ADD CONSTRAINT ficha_tecnica_upload_id_key UNIQUE (upload_id);


--
-- TOC entry 4898 (class 2606 OID 84888)
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- TOC entry 4900 (class 2606 OID 84890)
-- Name: profiles profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);


--
-- TOC entry 4902 (class 2606 OID 84892)
-- Name: scene_segments scene_segments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scene_segments
    ADD CONSTRAINT scene_segments_pkey PRIMARY KEY (id);


--
-- TOC entry 4904 (class 2606 OID 84894)
-- Name: transcriptions transcriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transcriptions
    ADD CONSTRAINT transcriptions_pkey PRIMARY KEY (id);


--
-- TOC entry 4923 (class 2606 OID 84896)
-- Name: video_reels unique_path; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.video_reels
    ADD CONSTRAINT unique_path UNIQUE (path);


--
-- TOC entry 4911 (class 2606 OID 84898)
-- Name: uploads uploads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.uploads
    ADD CONSTRAINT uploads_pkey PRIMARY KEY (id);


--
-- TOC entry 4913 (class 2606 OID 84900)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 4915 (class 2606 OID 84902)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 4917 (class 2606 OID 84904)
-- Name: video_frames video_frames_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.video_frames
    ADD CONSTRAINT video_frames_pkey PRIMARY KEY (id);


--
-- TOC entry 4919 (class 2606 OID 84906)
-- Name: video_objects video_objects_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.video_objects
    ADD CONSTRAINT video_objects_pkey PRIMARY KEY (id);


--
-- TOC entry 4921 (class 2606 OID 84908)
-- Name: video_poses video_poses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.video_poses
    ADD CONSTRAINT video_poses_pkey PRIMARY KEY (id);


--
-- TOC entry 4925 (class 2606 OID 84910)
-- Name: video_reels video_reels_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.video_reels
    ADD CONSTRAINT video_reels_pkey PRIMARY KEY (id);


--
-- TOC entry 4927 (class 2606 OID 84912)
-- Name: video_subtitulos video_subtitulos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.video_subtitulos
    ADD CONSTRAINT video_subtitulos_pkey PRIMARY KEY (id);


--
-- TOC entry 4880 (class 1259 OID 84913)
-- Name: idx_audit_action; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_action ON public.audit_logs USING btree (action);


--
-- TOC entry 4881 (class 1259 OID 84914)
-- Name: idx_audit_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_created ON public.audit_logs USING btree (created_at DESC);


--
-- TOC entry 4882 (class 1259 OID 84915)
-- Name: idx_audit_tenant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_tenant ON public.audit_logs USING btree (tenant_id);


--
-- TOC entry 4883 (class 1259 OID 84916)
-- Name: idx_audit_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_user ON public.audit_logs USING btree (user_id);


--
-- TOC entry 4884 (class 1259 OID 84917)
-- Name: idx_audit_user_tenant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_user_tenant ON public.audit_logs USING btree (user_id, tenant_id, created_at DESC);


--
-- TOC entry 4887 (class 1259 OID 84918)
-- Name: idx_comments_upload_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_comments_upload_created ON public.comments USING btree (upload_id, created_at DESC);


--
-- TOC entry 4894 (class 1259 OID 84919)
-- Name: idx_ficha_upload_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ficha_upload_id ON public.ficha_tecnica USING btree (upload_id);


--
-- TOC entry 4895 (class 1259 OID 84920)
-- Name: idx_profiles_participaciones_gin; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_profiles_participaciones_gin ON public.profiles USING gin (participaciones);


--
-- TOC entry 4896 (class 1259 OID 84921)
-- Name: idx_profiles_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_profiles_user_id ON public.profiles USING btree (user_id);


--
-- TOC entry 4905 (class 1259 OID 84922)
-- Name: idx_uploads_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_uploads_category ON public.uploads USING btree (category);


--
-- TOC entry 4906 (class 1259 OID 84923)
-- Name: idx_uploads_category_subcategory; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_uploads_category_subcategory ON public.uploads USING btree (category, subcategory);


--
-- TOC entry 4907 (class 1259 OID 84924)
-- Name: idx_uploads_subcategory; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_uploads_subcategory ON public.uploads USING btree (subcategory);


--
-- TOC entry 4908 (class 1259 OID 84925)
-- Name: idx_uploads_uploaded_at_desc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_uploads_uploaded_at_desc ON public.uploads USING btree (uploaded_at DESC);


--
-- TOC entry 4909 (class 1259 OID 84926)
-- Name: uploads_category_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX uploads_category_idx ON public.uploads USING btree (category);


--
-- TOC entry 4935 (class 2620 OID 84927)
-- Name: ficha_tecnica ficha_tecnica_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER ficha_tecnica_set_updated_at BEFORE UPDATE ON public.ficha_tecnica FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- TOC entry 4936 (class 2620 OID 84928)
-- Name: profiles trg_profiles_updated; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- TOC entry 4937 (class 2620 OID 84929)
-- Name: uploads trg_uploads_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_uploads_updated_at BEFORE UPDATE ON public.uploads FOR EACH ROW EXECUTE FUNCTION public.uploads_set_timestamp();


--
-- TOC entry 4928 (class 2606 OID 84930)
-- Name: comments comments_upload_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES public.uploads(id) ON DELETE CASCADE;


--
-- TOC entry 4929 (class 2606 OID 84935)
-- Name: comments comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 4930 (class 2606 OID 84940)
-- Name: documentos_texto documentos_texto_video_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documentos_texto
    ADD CONSTRAINT documentos_texto_video_id_fkey FOREIGN KEY (video_id) REFERENCES public.uploads(id);


--
-- TOC entry 4931 (class 2606 OID 84945)
-- Name: ficha_tecnica ficha_tecnica_upload_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ficha_tecnica
    ADD CONSTRAINT ficha_tecnica_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES public.uploads(id) ON DELETE CASCADE;


--
-- TOC entry 4932 (class 2606 OID 84950)
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4933 (class 2606 OID 84955)
-- Name: video_reels video_reels_video_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.video_reels
    ADD CONSTRAINT video_reels_video_id_fkey FOREIGN KEY (video_id) REFERENCES public.uploads(id);


--
-- TOC entry 4934 (class 2606 OID 84960)
-- Name: video_subtitulos video_subtitulos_video_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.video_subtitulos
    ADD CONSTRAINT video_subtitulos_video_id_fkey FOREIGN KEY (video_id) REFERENCES public.uploads(id);


--
-- TOC entry 5090 (class 0 OID 0)
-- Dependencies: 6
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO PUBLIC;


-- Completed on 2026-04-13 11:19:55

--
-- PostgreSQL database dump complete
--

